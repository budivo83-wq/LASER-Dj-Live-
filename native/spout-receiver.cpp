// Windows-only optional Spout2 receiver. Uses the official SpoutLibrary.h
// supplied by the user from https://github.com/leadedge/Spout2 .
// It cannot control lasers, USB, DACs, or ILDA hardware.

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <io.h>
#include <fcntl.h>
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <string>
#include <thread>
#include <vector>
#include "SpoutLibrary.h"

namespace {
constexpr int WIDTH = 96;
constexpr int HEIGHT = 54;
constexpr uint64_t MAX_SOURCE_PIXELS = 16000000ULL;

std::string escapeJson(const std::string& source) {
  std::string out;
  out.reserve(source.size() + 8);
  for (unsigned char c : source) {
    if (c == '"' || c == '\\') { out += '\\'; out += char(c); }
    else if (c >= 32 && c < 127) out += char(c);
    else out += '?';
  }
  return out;
}

std::string base64(const unsigned char* bytes, size_t length) {
  constexpr char ALPHABET[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve(((length + 2) / 3) * 4);
  for (size_t i = 0; i < length; i += 3) {
    const uint32_t a = bytes[i];
    const uint32_t b = i + 1 < length ? bytes[i + 1] : 0;
    const uint32_t c = i + 2 < length ? bytes[i + 2] : 0;
    const uint32_t v = (a << 16) | (b << 8) | c;
    out += ALPHABET[(v >> 18) & 63];
    out += ALPHABET[(v >> 12) & 63];
    out += i + 1 < length ? ALPHABET[(v >> 6) & 63] : '=';
    out += i + 2 < length ? ALPHABET[v & 63] : '=';
  }
  return out;
}

void emitError(const std::string& message) {
  std::printf("{\"type\":\"error\",\"message\":\"%s\"}\n", escapeJson(message).c_str());
  std::fflush(stdout);
}

// Nearest-neighbor downsampling avoids shipping full-resolution RGB data
// between the Spout GPU receiver and the Electron renderer.
void downsample(const std::vector<unsigned char>& src, unsigned int w, unsigned int h,
                std::vector<unsigned char>& dst) {
  for (int y = 0; y < HEIGHT; ++y) {
    const unsigned int sy = std::min(h - 1, unsigned((uint64_t(y) * h) / HEIGHT));
    for (int x = 0; x < WIDTH; ++x) {
      const unsigned int sx = std::min(w - 1, unsigned((uint64_t(x) * w) / WIDTH));
      const size_t srcIndex = (size_t(sy) * w + sx) * 4;
      const size_t dstIndex = (size_t(y) * WIDTH + x) * 4;
      for (int channel = 0; channel < 4; ++channel) dst[dstIndex + channel] = src[srcIndex + channel];
    }
  }
}

struct SpoutHandle {
  HMODULE dll = nullptr;
  SPOUTHANDLE receiver = nullptr;
  ~SpoutHandle() {
    if (receiver) { receiver->ReleaseReceiver(); receiver->Release(); }
    if (dll) FreeLibrary(dll);
  }
};
} // namespace

int main(int argc, char** argv) {
  _setmode(_fileno(stdout), _O_BINARY);
  setvbuf(stdout, nullptr, _IONBF, 0);
  bool listOnly = false, streaming = false;
  std::string sender;
  int fps = 20;
  for (int i = 1; i < argc; ++i) {
    if (std::strcmp(argv[i], "--list") == 0) listOnly = true;
    else if (std::strcmp(argv[i], "--stream") == 0) streaming = true;
    else if (std::strcmp(argv[i], "--sender") == 0 && i + 1 < argc) sender = argv[++i];
    else if (std::strcmp(argv[i], "--fps") == 0 && i + 1 < argc) fps = std::atoi(argv[++i]);
  }
  if ((!listOnly && !streaming) || fps < 1 || fps > 30 || sender.size() > 256) {
    emitError("Pouziti: --list nebo --stream [--sender NAZEV] [--fps 1..30]");
    return 2;
  }

  SpoutHandle handle;
  handle.dll = LoadLibraryW(L"SpoutLibrary.dll");
  if (!handle.dll) { emitError("Nenalezena SpoutLibrary.dll vedle receiver.exe"); return 3; }
  using GetSpoutFn = SPOUTHANDLE (WINAPI*)();
  const auto factory = reinterpret_cast<GetSpoutFn>(GetProcAddress(handle.dll, "GetSpout"));
  if (!factory) { emitError("DLL nema export GetSpout"); return 4; }
  handle.receiver = factory();
  if (!handle.receiver) { emitError("Spout2 se nepodarilo inicializovat"); return 5; }

  if (listOnly) {
    std::printf("{\"type\":\"sources\",\"senders\":[");
    const auto senders = handle.receiver->GetSenderList();
    for (size_t i = 0; i < senders.size() && i < 64; ++i) {
      if (i) std::printf(",");
      std::printf("\"%s\"", escapeJson(senders[i]).c_str());
    }
    std::printf("]}\n");
    return 0;
  }

  handle.receiver->SetReceiverName(sender.empty() ? nullptr : sender.c_str());
  std::vector<unsigned char> rgba, thumbnail(WIDTH * HEIGHT * 4);
  unsigned int allocatedW = 0, allocatedH = 0;
  const auto delay = std::chrono::milliseconds(1000 / fps);
  auto next = std::chrono::steady_clock::now();
  std::string lastSender;
  for (;;) {
    next += delay;
    if (!handle.receiver->IsConnected()) {
      if (!lastSender.empty()) {
        std::printf("{\"type\":\"status\",\"message\":\"Zdroj odpojen\"}\n");
        lastSender.clear();
      }
      // NULL texture first discovers the sender and negotiated dimensions.
      if (!handle.receiver->ReceiveTexture()) {
        allocatedW = allocatedH = 0; rgba.clear();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        next = std::chrono::steady_clock::now();
        continue;
      }
    }

    const auto w = handle.receiver->GetSenderWidth();
    const auto h = handle.receiver->GetSenderHeight();
    if (!w || !h || uint64_t(w) * h > MAX_SOURCE_PIXELS) {
      std::this_thread::sleep_for(std::chrono::milliseconds(100));
      next = std::chrono::steady_clock::now();
      continue;
    }
    if (w != allocatedW || h != allocatedH) {
      allocatedW = w; allocatedH = h;
      rgba.resize(size_t(w) * h * 4);
      continue;
    }
    if (!handle.receiver->ReceiveImage(rgba.data(), GL_RGBA, false)) {
      std::this_thread::sleep_for(std::chrono::milliseconds(20));
      continue;
    }
    if (!handle.receiver->IsFrameNew()) {
      std::this_thread::sleep_until(next);
      continue;
    }
    const std::string name = handle.receiver->GetSenderName() ? handle.receiver->GetSenderName() : "";
    if (name != lastSender) {
      lastSender = name;
      std::printf("{\"type\":\"status\",\"message\":\"Pripojeno\",\"sender\":\"%s\"}\n",
        escapeJson(name).c_str());
    }
    downsample(rgba, w, h, thumbnail);
    const std::string payload = base64(thumbnail.data(), thumbnail.size());
    std::printf("{\"type\":\"frame\",\"w\":%d,\"h\":%d,\"rgba\":\"%s\"}\n",
      WIDTH, HEIGHT, payload.c_str());
    std::this_thread::sleep_until(next);
    if (next < std::chrono::steady_clock::now() - delay) next = std::chrono::steady_clock::now();
  }
}
