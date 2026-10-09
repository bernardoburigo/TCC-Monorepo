package br.unesc.tcc.backend.sensor;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;

// Estado de conectividade de um sensor, derivado de QUANDO a última leitura foi
// recebida pelo backend (recebido_em), não do timestamp medido pelo ESP32: após uma
// queda de rede o firmware reenvia leituras antigas, e o que importa para "está
// vivo?" é que voltou a chegar dado.
public enum StatusSensor {
    ONLINE,
    OFFLINE,
    SEM_DADOS;

    public static StatusSensor de(Instant ultimaRecebidaEm, Instant agora, Duration limiteOffline) {
        if (ultimaRecebidaEm == null) {
            return SEM_DADOS;
        }
        // relógio do banco ligeiramente à frente do da JVM dá duração negativa: conta como online
        return Duration.between(ultimaRecebidaEm, agora).compareTo(limiteOffline) <= 0 ? ONLINE : OFFLINE;
    }

    // Status agregado de um apartamento: um sensor online basta para "online".
    public static StatusSensor agregar(Collection<StatusSensor> status) {
        if (status.contains(ONLINE)) {
            return ONLINE;
        }
        if (status.contains(OFFLINE)) {
            return OFFLINE;
        }
        return SEM_DADOS;
    }

}
