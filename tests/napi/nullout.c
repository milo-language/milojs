// A NULL out-param is a caller bug that node DEFINES: it answers
// napi_invalid_arg and writes nothing. milojs wrote to address 0, which killed
// the process mid-callback with no output and exit code 0 — a CI run reads that
// as success, which is worse than the crash it looks like.
//
// This addon asks for that status deliberately. It is a link-and-behaviour test:
// the assertion is that the status comes back, not that the process survives by
// luck.
#include <stddef.h>
#include <stdint.h>
typedef void *napi_env; typedef void *napi_value; typedef void *napi_callback_info;
typedef int32_t napi_status;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
extern napi_status napi_create_object(napi_env, napi_value *);
extern napi_status napi_create_int32(napi_env, int32_t, napi_value *);
extern napi_status napi_create_function(napi_env, const char *, size_t, napi_callback, void *, napi_value *);
extern napi_status napi_set_named_property(napi_env, napi_value, const char *, napi_value);
static napi_value probe(napi_env env, napi_callback_info info) {
  // a NULL out-param: node answers napi_invalid_arg, it does not write
  napi_status st = napi_create_int32(env, 7, NULL);
  napi_value out;
  napi_create_int32(env, (int32_t)st, &out);
  return out;
}
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "probe", (size_t)-1, probe, NULL, &fn);
  napi_set_named_property(env, exports, "probe", fn);
  return exports;
}
