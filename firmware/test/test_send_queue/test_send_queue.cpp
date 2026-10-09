#include <unity.h>

#include "SendQueue.h"
#include "SendPolicy.h"

void setUp(void) {}
void tearDown(void) {}

void test_new_queue_is_empty() {
    SendQueue<int, 3> q;
    int out = -1;
    TEST_ASSERT_TRUE(q.empty());
    TEST_ASSERT_EQUAL_size_t(0, q.size());
    TEST_ASSERT_FALSE(q.peek(out));
    TEST_ASSERT_EQUAL_INT(-1, out);
}

void test_fifo_order() {
    SendQueue<int, 3> q;
    q.push(1);
    q.push(2);
    q.push(3);

    int out = 0;
    TEST_ASSERT_TRUE(q.peek(out));
    TEST_ASSERT_EQUAL_INT(1, out);
    q.pop();
    TEST_ASSERT_TRUE(q.peek(out));
    TEST_ASSERT_EQUAL_INT(2, out);
    q.pop();
    TEST_ASSERT_TRUE(q.peek(out));
    TEST_ASSERT_EQUAL_INT(3, out);
    q.pop();
    TEST_ASSERT_TRUE(q.empty());
}

void test_peek_does_not_remove() {
    SendQueue<int, 3> q;
    q.push(7);
    int out = 0;
    q.peek(out);
    q.peek(out);
    TEST_ASSERT_EQUAL_size_t(1, q.size());
}

void test_overflow_drops_oldest_and_counts() {
    SendQueue<int, 3> q;
    TEST_ASSERT_FALSE(q.push(1));
    TEST_ASSERT_FALSE(q.push(2));
    TEST_ASSERT_FALSE(q.push(3));
    TEST_ASSERT_TRUE(q.push(4));  // cheia: descarta o 1
    TEST_ASSERT_TRUE(q.push(5));  // descarta o 2

    TEST_ASSERT_EQUAL_size_t(3, q.size());
    TEST_ASSERT_EQUAL_UINT32(2, q.droppedCount());

    int out = 0;
    q.peek(out);
    TEST_ASSERT_EQUAL_INT(3, out);
}

void test_wraparound_keeps_order() {
    SendQueue<int, 3> q;
    int out = 0;
    for (int i = 0; i < 10; i++) {
        q.push(i);
        q.peek(out);
        TEST_ASSERT_EQUAL_INT(i, out);
        q.pop();
    }
    TEST_ASSERT_TRUE(q.empty());
    TEST_ASSERT_EQUAL_UINT32(0, q.droppedCount());
}

void test_pop_on_empty_is_safe() {
    SendQueue<int, 3> q;
    q.pop();
    TEST_ASSERT_TRUE(q.empty());
}

void test_classify_success_statuses() {
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Sent, (int)classifyHttpStatus(201));
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Sent, (int)classifyHttpStatus(200));
    // 409 = o backend ja tem essa leitura (reenvio apos resposta perdida): sucesso.
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Sent, (int)classifyHttpStatus(409));
}

void test_classify_400_is_drop() {
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Drop, (int)classifyHttpStatus(400));
}

void test_classify_401_is_auth_error() {
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::AuthError, (int)classifyHttpStatus(401));
}

void test_classify_transient_failures_are_retry() {
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Retry, (int)classifyHttpStatus(500));
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Retry, (int)classifyHttpStatus(503));
    // codigos negativos do HTTPClient (conexao recusada, timeout, sem rede)
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Retry, (int)classifyHttpStatus(-1));
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Retry, (int)classifyHttpStatus(-11));
    // 403/404 nao fazem parte do contrato; tratar como transitorio evita perder dados
    TEST_ASSERT_EQUAL_INT((int)SendOutcome::Retry, (int)classifyHttpStatus(404));
}

void test_backoff_doubles_until_cap() {
    TEST_ASSERT_EQUAL_UINT32(5000, nextBackoffMs(0, 5000, 60000));
    TEST_ASSERT_EQUAL_UINT32(10000, nextBackoffMs(1, 5000, 60000));
    TEST_ASSERT_EQUAL_UINT32(20000, nextBackoffMs(2, 5000, 60000));
    TEST_ASSERT_EQUAL_UINT32(40000, nextBackoffMs(3, 5000, 60000));
    TEST_ASSERT_EQUAL_UINT32(60000, nextBackoffMs(4, 5000, 60000));
}

void test_backoff_never_overflows() {
    TEST_ASSERT_EQUAL_UINT32(60000, nextBackoffMs(31, 5000, 60000));
    TEST_ASSERT_EQUAL_UINT32(60000, nextBackoffMs(1000, 5000, 60000));
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_new_queue_is_empty);
    RUN_TEST(test_fifo_order);
    RUN_TEST(test_peek_does_not_remove);
    RUN_TEST(test_overflow_drops_oldest_and_counts);
    RUN_TEST(test_wraparound_keeps_order);
    RUN_TEST(test_pop_on_empty_is_safe);
    RUN_TEST(test_classify_success_statuses);
    RUN_TEST(test_classify_400_is_drop);
    RUN_TEST(test_classify_401_is_auth_error);
    RUN_TEST(test_classify_transient_failures_are_retry);
    RUN_TEST(test_backoff_doubles_until_cap);
    RUN_TEST(test_backoff_never_overflows);
    return UNITY_END();
}
