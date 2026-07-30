#ifndef MILOJS_H
#define MILOJS_H

#include "libmilojs.h"

enum milojs_status {
    MILOJS_STATUS_OK = 0,
    MILOJS_STATUS_INVALID_ARGUMENT = -1,
    MILOJS_STATUS_BUSY = -2,
    MILOJS_STATUS_INVALID_CONTEXT = -3,
};

#endif
