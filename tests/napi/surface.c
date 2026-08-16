// Exercises the Node-API entry points that were MISSING from the binary rather
// than stubbed. A missing symbol makes dlopen fail before the addon runs a line,
// so this is a LINK test first: if one regresses out of the build, loading this
// file fails outright.
//
// The ABI is declared by hand, as callback.c does: there is no node_api.h here.
#include <stddef.h>
#include <stdint.h>

typedef void *napi_env;
typedef void *napi_value;
typedef void *napi_callback_info;
typedef void *napi_handle_scope;
typedef void *napi_escapable_handle_scope;
typedef void *napi_async_work;
typedef int32_t napi_status;
typedef int32_t napi_typedarray_type;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
typedef void (*napi_async_execute_callback)(napi_env, void *);
typedef void (*napi_async_complete_callback)(napi_env, napi_status, void *);

typedef struct {
  const char *utf8name;
  napi_value name;
  napi_callback method;
  napi_callback getter;
  napi_callback setter;
  napi_value value;
  int32_t attributes;
  void *data;
} napi_property_descriptor;

typedef struct {
  const char *error_message;
  void *engine_reserved;
  uint32_t engine_error_code;
  napi_status error_code;
} napi_extended_error_info;

extern napi_status napi_create_object(napi_env, napi_value *);
extern napi_status napi_create_int32(napi_env, int32_t, napi_value *);
extern napi_status napi_create_int64(napi_env, int64_t, napi_value *);
extern napi_status napi_get_boolean(napi_env, _Bool, napi_value *);
extern napi_status napi_create_string_utf8(napi_env, const char *, size_t, napi_value *);
extern napi_status napi_set_named_property(napi_env, napi_value, const char *, napi_value);
extern napi_status napi_get_named_property(napi_env, napi_value, const char *, napi_value *);
extern napi_status napi_get_cb_info(napi_env, napi_callback_info, size_t *, napi_value *, napi_value *, void **);

extern napi_status napi_open_handle_scope(napi_env, napi_handle_scope *);
extern napi_status napi_close_handle_scope(napi_env, napi_handle_scope);
extern napi_status napi_open_escapable_handle_scope(napi_env, napi_escapable_handle_scope *);
extern napi_status napi_close_escapable_handle_scope(napi_env, napi_escapable_handle_scope);
extern napi_status napi_escape_handle(napi_env, napi_escapable_handle_scope, napi_value, napi_value *);
extern napi_status napi_is_exception_pending(napi_env, _Bool *);
extern napi_status napi_get_last_error_info(napi_env, const napi_extended_error_info **);
extern napi_status napi_create_type_error(napi_env, napi_value, napi_value, napi_value *);
extern napi_status napi_create_string_latin1(napi_env, const char *, size_t, napi_value *);
extern napi_status napi_get_value_int64(napi_env, napi_value, int64_t *);
extern napi_status napi_has_property(napi_env, napi_value, napi_value, _Bool *);
extern napi_status napi_has_own_property(napi_env, napi_value, napi_value, _Bool *);
extern napi_status napi_define_properties(napi_env, napi_value, size_t, const napi_property_descriptor *);
extern napi_status napi_get_typedarray_info(napi_env, napi_value, napi_typedarray_type *, size_t *, void **, napi_value *, size_t *);
extern napi_status napi_create_external(napi_env, void *, void *, void *, napi_value *);
extern napi_status napi_get_value_external(napi_env, napi_value, void **);
extern napi_status napi_create_async_work(napi_env, napi_value, napi_value, napi_async_execute_callback, napi_async_complete_callback, void *, napi_async_work *);
extern napi_status napi_queue_async_work(napi_env, napi_async_work);
extern napi_status napi_delete_async_work(napi_env, napi_async_work);

static napi_value scopes(napi_env env, napi_callback_info info) {
  napi_handle_scope hs;
  napi_open_handle_scope(env, &hs);
  napi_value inner;
  napi_create_int32(env, 42, &inner);
  napi_close_handle_scope(env, hs);

  napi_escapable_handle_scope ehs;
  napi_open_escapable_handle_scope(env, &ehs);
  napi_value made;
  napi_create_int32(env, 7, &made);
  napi_value escaped;
  napi_escape_handle(env, ehs, made, &escaped);
  napi_close_escapable_handle_scope(env, ehs);

  _Bool pending = 1;
  napi_is_exception_pending(env, &pending);
  const napi_extended_error_info *ei = NULL;
  napi_get_last_error_info(env, &ei);

  napi_value out, one, pend, hasInfo;
  napi_create_object(env, &out);
  napi_create_int32(env, 1, &one);
  napi_set_named_property(env, out, "scopesOk", one);
  napi_set_named_property(env, out, "escaped", escaped);
  napi_get_boolean(env, pending, &pend);
  napi_set_named_property(env, out, "exceptionPending", pend);
  napi_get_boolean(env, ei != NULL, &hasInfo);
  napi_set_named_property(env, out, "hasErrorInfo", hasInfo);
  return out;
}

static napi_value values(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

  napi_value out;
  napi_create_object(env, &out);

  // 0xE9 is e-acute in latin1; read as UTF-8 it is a broken lead byte
  const char latin1[] = { 'c', 'a', 'f', (char)0xE9, 0 };
  napi_value s;
  napi_create_string_latin1(env, latin1, 4, &s);
  napi_set_named_property(env, out, "latin1", s);

  int64_t big = 0;
  napi_get_value_int64(env, argv[0], &big);
  napi_value bigv;
  napi_create_int64(env, big, &bigv);
  napi_set_named_property(env, out, "int64", bigv);

  napi_value key;
  napi_create_string_utf8(env, "toString", (size_t)-1, &key);
  _Bool has = 0, hasOwn = 1;
  napi_has_property(env, out, key, &has);
  napi_has_own_property(env, out, key, &hasOwn);
  napi_value hv, hov;
  napi_get_boolean(env, has, &hv);
  napi_get_boolean(env, hasOwn, &hov);
  napi_set_named_property(env, out, "hasInherited", hv);
  napi_set_named_property(env, out, "hasOwnInherited", hov);
  return out;
}

static napi_value getter_impl(napi_env env, napi_callback_info info) {
  napi_value v; napi_create_int32(env, 99, &v); return v;
}
static napi_value method_impl(napi_env env, napi_callback_info info) {
  napi_value v; napi_create_int32(env, 5, &v); return v;
}

static napi_value defineProps(napi_env env, napi_callback_info info) {
  napi_value out, forty;
  napi_create_object(env, &out);
  napi_create_int32(env, 40, &forty);
  napi_property_descriptor descs[3] = {
    { "dataProp", NULL, NULL, NULL, NULL, forty, 0, NULL },
    { "methodProp", NULL, method_impl, NULL, NULL, NULL, 0, NULL },
    { "accessorProp", NULL, NULL, getter_impl, NULL, NULL, 0, NULL },
  };
  napi_define_properties(env, out, 3, descs);
  return out;
}

static napi_value taInfo(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

  napi_typedarray_type type = 0;
  size_t length = 0, offset = 0;
  void *data = NULL;
  napi_value buffer;
  napi_get_typedarray_info(env, argv[0], &type, &length, &data, &buffer, &offset);

  napi_value out, t, l, o, firstByte;
  napi_create_object(env, &out);
  napi_create_int32(env, (int32_t)type, &t);
  napi_create_int32(env, (int32_t)length, &l);
  napi_create_int32(env, (int32_t)offset, &o);
  napi_create_int32(env, data ? (int32_t)(((unsigned char *)data)[0]) : -1, &firstByte);
  napi_set_named_property(env, out, "type", t);
  napi_set_named_property(env, out, "length", l);
  napi_set_named_property(env, out, "byteOffset", o);
  napi_set_named_property(env, out, "firstByte", firstByte);
  return out;
}

static int external_marker = 0x5A;
static napi_value externalRoundTrip(napi_env env, napi_callback_info info) {
  napi_value ext;
  napi_create_external(env, &external_marker, NULL, NULL, &ext);
  void *back = NULL;
  napi_get_value_external(env, ext, &back);
  napi_value out;
  napi_get_boolean(env, back == &external_marker, &out);
  return out;
}

// node runs execute on a threadpool; this asserts only that both callbacks ran
// and in order, which is the contract an addon actually depends on.
static int work_trace = 0;
static void work_execute(napi_env env, void *data) { work_trace = work_trace * 10 + 1; }
static void work_complete(napi_env env, napi_status status, void *data);

// The work handle is deleted from the COMPLETE callback, not straight after
// queueing: node runs execute on a threadpool, so deleting it at the queue site
// frees it out from under a live worker (node segfaults, which is how this test
// learned the rule).
static napi_async_work pending_work = NULL;

static napi_value startWork(napi_env env, napi_callback_info info) {
  work_trace = 0;
  napi_value name;
  napi_create_string_utf8(env, "surface-test", (size_t)-1, &name);
  napi_create_async_work(env, NULL, name, work_execute, work_complete, NULL, &pending_work);
  napi_queue_async_work(env, pending_work);
  napi_value out;
  napi_create_int32(env, 1, &out);
  return out;
}

static napi_value readTrace(napi_env env, napi_callback_info info) {
  napi_value out;
  napi_create_int32(env, work_trace, &out);
  return out;
}

static void work_complete(napi_env env, napi_status status, void *data) {
  work_trace = work_trace * 10 + 2;
  if (pending_work) { napi_delete_async_work(env, pending_work); pending_work = NULL; }
}

static napi_value typeErr(napi_env env, napi_callback_info info) {
  napi_value msg, err, name;
  napi_create_string_utf8(env, "surface", (size_t)-1, &msg);
  napi_create_type_error(env, NULL, msg, &err);
  napi_get_named_property(env, err, "name", &name);
  return name;
}

extern napi_status napi_create_function(napi_env, const char *, size_t, napi_callback, void *, napi_value *);

napi_value napi_register_module_v1(napi_env env, napi_value exports) {
  struct { const char *n; napi_callback f; } fns[] = {
    { "scopes", scopes }, { "values", values }, { "defineProps", defineProps },
    { "taInfo", taInfo }, { "externalRoundTrip", externalRoundTrip },
    { "startWork", startWork }, { "readTrace", readTrace }, { "typeErr", typeErr },
  };
  for (unsigned i = 0; i < sizeof(fns) / sizeof(fns[0]); i++) {
    napi_value fn;
    napi_create_function(env, fns[i].n, (size_t)-1, fns[i].f, NULL, &fn);
    napi_set_named_property(env, exports, fns[i].n, fn);
  }
  return exports;
}
