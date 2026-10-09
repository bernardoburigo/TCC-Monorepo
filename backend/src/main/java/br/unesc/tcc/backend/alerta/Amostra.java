package br.unesc.tcc.backend.alerta;

import java.time.Instant;

// Uma leitura reduzida ao que o detector precisa (evita carregar a entidade inteira, com o
// sensor LAZY, para centenas de linhas). `timestamp` é o fim da janela medida no ESP32.
public record Amostra(Instant timestamp, long pulsos, double volumeMl) {
}
