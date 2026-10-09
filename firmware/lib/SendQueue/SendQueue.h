#pragma once

// Fila FIFO de tamanho fixo (ring buffer) para leituras ainda não confirmadas
// pelo backend. Quando cheia, descarta a mais antiga: preferimos perder o dado
// mais velho a travar a medição ou estourar a RAM do ESP32. Sem Arduino.h,
// testável nativamente.

#include <cstddef>
#include <cstdint>

template <typename T, size_t Capacity>
class SendQueue {
public:
    // Retorna true se precisou descartar a leitura mais antiga para abrir espaço.
    bool push(const T& item) {
        bool dropped = false;
        if (count_ == Capacity) {
            head_ = (head_ + 1) % Capacity;
            count_--;
            dropped_++;
            dropped = true;
        }
        items_[(head_ + count_) % Capacity] = item;
        count_++;
        return dropped;
    }

    // Copia o item mais antigo sem removê-lo (só sai da fila após o POST confirmar).
    bool peek(T& out) const {
        if (count_ == 0) {
            return false;
        }
        out = items_[head_];
        return true;
    }

    void pop() {
        if (count_ == 0) {
            return;
        }
        head_ = (head_ + 1) % Capacity;
        count_--;
    }

    size_t size() const { return count_; }
    bool empty() const { return count_ == 0; }
    uint32_t droppedCount() const { return dropped_; }

private:
    T items_[Capacity];
    size_t head_ = 0;
    size_t count_ = 0;
    uint32_t dropped_ = 0;
};
