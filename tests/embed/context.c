#include "milojs.h"

#include <stdint.h>
#include <stdio.h>
#include <string.h>

static int eval(int64_t context, const char *source, int64_t *value) {
    return milojs_eval(context, (uint8_t *)(uintptr_t)source,
                       (int64_t)strlen(source), value);
}

int main(void) {
    int64_t first = 0;
    int64_t second = 0;
    int64_t value = 0;

    if (milojs_context_new(NULL) != MILOJS_STATUS_INVALID_ARGUMENT) return 1;
    if (milojs_context_new(&first) != MILOJS_STATUS_OK || first == 0) return 2;
    if (milojs_context_new(&second) != MILOJS_STATUS_BUSY) return 3;
    if (milojs_context_free(first + 1) != MILOJS_STATUS_INVALID_CONTEXT) return 4;
    if (eval(first, "6 * 7", &value) != MILOJS_STATUS_OK) return 5;
    if (milojs_value_kind(first, value) != MILOJS_VALUE_NUMBER) return 6;
    double number = 0;
    if (milojs_value_number(first, value, &number) != MILOJS_STATUS_OK || number != 42) return 7;
    bool boolean = false;
    if (milojs_value_bool(first, value, &boolean) != MILOJS_STATUS_WRONG_TYPE) return 8;
    if (milojs_value_release(first, value) != MILOJS_STATUS_OK) return 9;
    if (milojs_value_kind(first, value) != MILOJS_STATUS_INVALID_ARGUMENT) return 10;

    if (eval(first, "'a\\0b'", &value) != MILOJS_STATUS_OK) return 11;
    if (milojs_value_kind(first, value) != MILOJS_VALUE_STRING) return 12;
    if (milojs_value_string_length(first, value) != 3) return 13;
    uint8_t bytes[3] = {0xff, 0xff, 0xff};
    if (milojs_value_string_copy(first, value, bytes, 3) != 3) return 14;
    if (bytes[0] != 'a' || bytes[1] != 0 || bytes[2] != 'b') return 15;
    if (milojs_value_release(first, value) != MILOJS_STATUS_OK) return 16;

    if (eval(first, "var persistent = 9", &value) != MILOJS_STATUS_OK) return 17;
    if (milojs_value_release(first, value) != MILOJS_STATUS_OK) return 18;
    if (eval(first, "persistent + 1", &value) != MILOJS_STATUS_OK) return 19;
    if (milojs_value_number(first, value, &number) != MILOJS_STATUS_OK || number != 10) return 20;
    if (milojs_value_release(first, value) != MILOJS_STATUS_OK) return 21;

    if (eval(first, "({x: 42})", &value) != MILOJS_STATUS_OK) return 22;
    if (milojs_value_kind(first, value) != MILOJS_VALUE_OBJECT) return 23;
    int64_t gc_value = 0;
    if (eval(first, "gc()", &gc_value) != MILOJS_STATUS_OK) return 24;
    if (milojs_value_release(first, gc_value) != MILOJS_STATUS_OK) return 25;
    int64_t property = 0;
    uint8_t key[] = {'x'};
    if (milojs_value_get(first, value, key, 1, &property) != MILOJS_STATUS_OK) return 26;
    if (milojs_value_number(first, property, &number) != MILOJS_STATUS_OK || number != 42) return 27;
    if (milojs_value_release(first, property) != MILOJS_STATUS_OK) return 28;
    if (milojs_value_release(first, value) != MILOJS_STATUS_OK) return 29;

    if (eval(first, "function (", &value) != MILOJS_STATUS_JS_EXCEPTION) return 30;
    if (milojs_exception_length(first) <= 0) return 31;

    if (eval(first, "throw new TypeError('bad')", &value) != MILOJS_STATUS_JS_EXCEPTION) return 32;
    int64_t exception_length = milojs_exception_length(first);
    if (exception_length <= 0 || exception_length >= 64) return 33;
    uint8_t exception[64] = {0};
    if (milojs_exception_copy(first, exception, 63) != exception_length) return 34;
    if (strcmp((const char *)exception, "TypeError: bad") != 0) return 35;

    if (milojs_context_free(first) != MILOJS_STATUS_OK) return 36;
    if (milojs_context_free(first) != MILOJS_STATUS_INVALID_CONTEXT) return 37;
    if (milojs_context_new(&second) != MILOJS_STATUS_OK || second == first) return 38;
    if (milojs_context_free(second) != MILOJS_STATUS_OK) return 39;

    puts("embedding context ok");
    return 0;
}
