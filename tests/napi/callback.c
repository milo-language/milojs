#include <stddef.h>
#include <stdint.h>

typedef void *napi_env;
typedef void *napi_value;
typedef void *napi_callback_info;
typedef int32_t napi_status;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);

extern napi_status napi_create_function(napi_env, const char *, size_t,
                                        napi_callback, void *, napi_value *);
extern napi_status napi_set_named_property(napi_env, napi_value, const char *,
                                           napi_value);
extern napi_status napi_get_cb_info(napi_env, napi_callback_info, size_t *,
                                    napi_value *, napi_value *, void **);
extern napi_status napi_create_int32(napi_env, int32_t, napi_value *);
extern napi_status napi_call_function(napi_env, napi_value, napi_value, size_t,
                                      const napi_value *, napi_value *);

static napi_value call_js(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1] = {0};
    napi_value receiver = 0;
    if (napi_get_cb_info(env, info, &argc, argv, &receiver, NULL) != 0 || argc != 1) {
        return 0;
    }

    napi_value argument = 0;
    if (napi_create_int32(env, 41, &argument) != 0) return 0;

    napi_value result = 0;
    if (napi_call_function(env, receiver, argv[0], 1, &argument, &result) != 0) return 0;
    return result;
}

__attribute__((visibility("default")))
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
    napi_value function = 0;
    if (napi_create_function(env, "callJs", (size_t)-1, call_js, NULL, &function) != 0) {
        return 0;
    }
    if (napi_set_named_property(env, exports, "callJs", function) != 0) return 0;
    return exports;
}
