#include "milojs.h"

#include <stdint.h>
#include <stdio.h>

int main(void) {
    int64_t first = 0;
    int64_t second = 0;

    if (milojs_context_new(NULL) != MILOJS_STATUS_INVALID_ARGUMENT) return 1;
    if (milojs_context_new(&first) != MILOJS_STATUS_OK || first == 0) return 2;
    if (milojs_context_new(&second) != MILOJS_STATUS_BUSY) return 3;
    if (milojs_context_free(first + 1) != MILOJS_STATUS_INVALID_CONTEXT) return 4;
    if (milojs_context_free(first) != MILOJS_STATUS_OK) return 5;
    if (milojs_context_free(first) != MILOJS_STATUS_INVALID_CONTEXT) return 6;
    if (milojs_context_new(&second) != MILOJS_STATUS_OK || second == first) return 7;
    if (milojs_context_free(second) != MILOJS_STATUS_OK) return 8;

    puts("embedding context ok");
    return 0;
}
