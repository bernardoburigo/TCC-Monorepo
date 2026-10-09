#include <unity.h>

#include "FlowMeter.h"

void setUp(void) {}
void tearDown(void) {}

void test_zero_pulses_returns_zero_flow() {
    FlowReading r = calculateFlow(0, 1000, 450.0f);
    TEST_ASSERT_EQUAL_DOUBLE(0.0, r.flowLPerMin);
    TEST_ASSERT_EQUAL_DOUBLE(0.0, r.volumeMl);
}

void test_zero_interval_does_not_divide_by_zero() {
    FlowReading r = calculateFlow(100, 0, 450.0f);
    TEST_ASSERT_EQUAL_DOUBLE(0.0, r.flowLPerMin);
    TEST_ASSERT_EQUAL_DOUBLE(0.0, r.volumeMl);
}

void test_known_pulses_match_datasheet_formula() {
    // 450 pulsos/L (f ≈ 7.5 Hz por L/min do datasheet do YF-S201).
    // 75 pulsos em 1s equivalem a 10 L/min.
    FlowReading r = calculateFlow(75, 1000, 450.0f);
    TEST_ASSERT_DOUBLE_WITHIN(0.01, 10.0, r.flowLPerMin);
    TEST_ASSERT_DOUBLE_WITHIN(0.01, 166.67, r.volumeMl);
}

void test_flow_scales_with_interval() {
    // Mesma quantidade de pulsos em um intervalo maior => vazão menor,
    // mas volume total igual.
    FlowReading r = calculateFlow(75, 2000, 450.0f);
    TEST_ASSERT_DOUBLE_WITHIN(0.01, 5.0, r.flowLPerMin);
    TEST_ASSERT_DOUBLE_WITHIN(0.01, 166.67, r.volumeMl);
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_zero_pulses_returns_zero_flow);
    RUN_TEST(test_zero_interval_does_not_divide_by_zero);
    RUN_TEST(test_known_pulses_match_datasheet_formula);
    RUN_TEST(test_flow_scales_with_interval);
    return UNITY_END();
}
