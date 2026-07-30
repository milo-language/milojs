// Minimal C host for the MiloJS embedding API.
#include <stdint.h>
#include <stdio.h>
#include "milojs.h"

int main(void) {
    uint8_t source[] = "let total = 40; total += 2; 'hello from embedded milo, woof! the answer is ' + total";
    int64_t context = 0;
    int64_t value = 0;
    uint8_t output[64];

    if (milojs_context_new(&context) != MILOJS_STATUS_OK) return 1;
    if (milojs_eval(context, source, sizeof(source) - 1, &value) != MILOJS_STATUS_OK) return 1;

    int64_t length = milojs_value_string_length(context, value);
    if (length < 0 || length >= (int64_t)sizeof(output)) return 1;
    if (milojs_value_string_copy(context, value, output, length) != length) return 1;
    output[length] = 0;
    puts((char *)output);

    milojs_value_release(context, value);
    milojs_context_free(context);
    return 0;
}
