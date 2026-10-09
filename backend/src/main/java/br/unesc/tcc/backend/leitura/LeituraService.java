package br.unesc.tcc.backend.leitura;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.common.CredenciaisInvalidasException;
import br.unesc.tcc.backend.common.LeituraDuplicadaException;
import br.unesc.tcc.backend.leitura.dto.LeituraRequest;
import br.unesc.tcc.backend.leitura.dto.LeituraResponse;
import br.unesc.tcc.backend.sensor.Sensor;
import br.unesc.tcc.backend.sensor.SensorRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LeituraService {

    private final LeituraRepository leituraRepository;
    private final SensorRepository sensorRepository;

    @Transactional
    public LeituraResponse registrar(String tokenSensor, LeituraRequest request) {
        Sensor sensor = sensorRepository.findByToken(tokenSensor)
                .orElseThrow(() -> new CredenciaisInvalidasException("Token de sensor inválido"));

        if (!sensor.isAtivo()) {
            throw new CredenciaisInvalidasException("Sensor inativo");
        }
        if (!sensor.getId().equals(request.sensorId())) {
            throw new CredenciaisInvalidasException("Token não corresponde ao sensorId informado");
        }

        Leitura leitura = Leitura.builder()
                .sensor(sensor)
                .timestampLeitura(request.timestampLeitura())
                .pulsos(request.pulsos())
                .volumeMlEstimado(request.volumeMlEstimado())
                .sequencia(request.sequencia())
                .build();

        try {
            // saveAndFlush força o INSERT agora, para a violação da constraint única
            // (sensor_id, sequencia, timestamp_leitura) estourar aqui, não no commit.
            leitura = leituraRepository.saveAndFlush(leitura);
        } catch (DataIntegrityViolationException ex) {
            throw new LeituraDuplicadaException(
                    "Leitura já registrada para sensorId=%s, sequencia=%d, timestamp=%s"
                            .formatted(sensor.getId(), request.sequencia(), request.timestampLeitura()));
        }

        return LeituraResponse.de(leitura);
    }

}
