#include <unity.h>

#include <string>

#include <ArduinoJson.h>

#include "LeituraPayload.h"

void setUp(void) {}
void tearDown(void) {}

void test_iso8601_epoch_zero() {
    TEST_ASSERT_EQUAL_STRING("1970-01-01T00:00:00.000Z", formatIso8601(0).c_str());
}

void test_iso8601_known_instant_with_milliseconds() {
    // 2026-09-25T12:00:05.123Z == 1790337605 s (UTC) + 123 ms
    TEST_ASSERT_EQUAL_STRING("2026-09-25T12:00:05.123Z", formatIso8601(1790337605123LL).c_str());
}

void test_iso8601_pads_milliseconds_with_zeros() {
    TEST_ASSERT_EQUAL_STRING("2026-09-25T12:00:05.007Z", formatIso8601(1790337605007LL).c_str());
    TEST_ASSERT_EQUAL_STRING("2026-09-25T12:00:05.000Z", formatIso8601(1790337605000LL).c_str());
}

void test_iso8601_second_boundary() {
    TEST_ASSERT_EQUAL_STRING("2026-09-25T12:00:05.999Z", formatIso8601(1790337605999LL).c_str());
    TEST_ASSERT_EQUAL_STRING("2026-09-25T12:00:06.000Z", formatIso8601(1790337606000LL).c_str());
}

void test_json_has_the_five_contract_fields_with_right_types() {
    Leitura l = {1790337605123LL, 37, 82.2, 4821};
    std::string json = buildLeituraJson("7c12d63c-f3eb-4c11-a0fc-2aee69f0ede5", l);

    JsonDocument doc;
    TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);

    TEST_ASSERT_EQUAL_size_t(5, doc.size());
    TEST_ASSERT_EQUAL_STRING("7c12d63c-f3eb-4c11-a0fc-2aee69f0ede5", doc["sensorId"].as<const char*>());
    TEST_ASSERT_EQUAL_STRING("2026-09-25T12:00:05.123Z", doc["timestampLeitura"].as<const char*>());
    TEST_ASSERT_TRUE(doc["pulsos"].is<int>());
    TEST_ASSERT_EQUAL_INT(37, doc["pulsos"].as<int>());
    TEST_ASSERT_TRUE(doc["volumeMlEstimado"].is<double>());
    TEST_ASSERT_DOUBLE_WITHIN(0.001, 82.2, doc["volumeMlEstimado"].as<double>());
    TEST_ASSERT_TRUE(doc["sequencia"].is<int>());
    TEST_ASSERT_EQUAL_INT(4821, doc["sequencia"].as<int>());
}

void test_json_heartbeat_window_with_zero_pulses() {
    // Janela sem fluxo: o backend aceita (@PositiveOrZero) e serve de heartbeat.
    Leitura l = {1790337610124LL, 0, 0.0, 0};
    std::string json = buildLeituraJson("s", l);

    JsonDocument doc;
    TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
    TEST_ASSERT_EQUAL_INT(0, doc["pulsos"].as<int>());
    TEST_ASSERT_DOUBLE_WITHIN(0.0001, 0.0, doc["volumeMlEstimado"].as<double>());
    TEST_ASSERT_EQUAL_INT(0, doc["sequencia"].as<int>());
}

void test_json_sequence_above_int32_is_not_truncated() {
    Leitura l = {1790337605123LL, 1, 1.0, 4294967295u};
    std::string json = buildLeituraJson("s", l);

    JsonDocument doc;
    TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
    TEST_ASSERT_TRUE(doc["sequencia"].as<uint32_t>() == 4294967295u);
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_iso8601_epoch_zero);
    RUN_TEST(test_iso8601_known_instant_with_milliseconds);
    RUN_TEST(test_iso8601_pads_milliseconds_with_zeros);
    RUN_TEST(test_iso8601_second_boundary);
    RUN_TEST(test_json_has_the_five_contract_fields_with_right_types);
    RUN_TEST(test_json_heartbeat_window_with_zero_pulses);
    RUN_TEST(test_json_sequence_above_int32_is_not_truncated);
    return UNITY_END();
}
