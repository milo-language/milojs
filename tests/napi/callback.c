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
extern napi_status napi_create_buffer(napi_env, size_t, void **, napi_value *);
extern napi_status napi_create_buffer_copy(napi_env, size_t, const void *, void **,
                                           napi_value *);
extern napi_status napi_get_buffer_info(napi_env, napi_value, void **, size_t *);

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

static napi_value make_buffer(napi_env env, napi_callback_info info) {
    (void)info;
    uint8_t *data = NULL;
    napi_value result = 0;
    if (napi_create_buffer(env, 4, (void **)&data, &result) != 0) return 0;
    for (size_t i = 0; i < 4; i++) data[i] = (uint8_t)(i + 1);
    return result;
}

static napi_value mutate_buffer(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1] = {0};
    if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != 0 || argc != 1) return 0;
    uint8_t *data = NULL;
    size_t length = 0;
    if (napi_get_buffer_info(env, argv[0], (void **)&data, &length) != 0) return 0;
    int32_t sum = 0;
    for (size_t i = 0; i < length; i++) sum += data[i];
    if (length > 1) data[1] = 9;
    napi_value result = 0;
    if (napi_create_int32(env, sum, &result) != 0) return 0;
    return result;
}

static napi_value copy_buffer(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1] = {0};
    if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != 0 || argc != 1) return 0;
    uint8_t *source = NULL;
    size_t length = 0;
    if (napi_get_buffer_info(env, argv[0], (void **)&source, &length) != 0) return 0;
    napi_value result = 0;
    if (napi_create_buffer_copy(env, length, source, NULL, &result) != 0) return 0;
    return result;
}

static int export_function(napi_env env, napi_value exports, const char *name,
                           napi_callback callback) {
    napi_value function = 0;
    if (napi_create_function(env, name, (size_t)-1, callback, NULL, &function) != 0) return 0;
    return napi_set_named_property(env, exports, name, function) == 0;
}

__attribute__((visibility("default")))
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
    if (!export_function(env, exports, "callJs", call_js)) return 0;
    if (!export_function(env, exports, "makeBuffer", make_buffer)) return 0;
    if (!export_function(env, exports, "mutateBuffer", mutate_buffer)) return 0;
    if (!export_function(env, exports, "copyBuffer", copy_buffer)) return 0;
    return exports;
}
