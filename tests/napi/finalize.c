// Finalizers: napi_wrap, napi_add_finalizer and napi_create_external each hand
// the runtime a callback that frees `data`, and the runtime must call it exactly
// once after the object dies, never while it is reachable, and never after
// napi_remove_wrap took the data back. The counters are the double-free and
// leak detectors; `bad` counts a callback that got the wrong data or hint.
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
typedef void *napi_env; typedef void *napi_value; typedef void *napi_callback_info;
typedef void *napi_ref;
typedef int32_t napi_status;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
typedef void (*napi_finalize)(napi_env, void *, void *);
extern napi_status napi_create_object(napi_env, napi_value *);
extern napi_status napi_create_int32(napi_env, int32_t, napi_value *);
extern napi_status napi_get_boolean(napi_env, int, napi_value *);
extern napi_status napi_create_function(napi_env, const char *, size_t, napi_callback, void *, napi_value *);
extern napi_status napi_set_named_property(napi_env, napi_value, const char *, napi_value);
extern napi_status napi_get_cb_info(napi_env, napi_callback_info, size_t *, napi_value *, napi_value *, void **);
extern napi_status napi_wrap(napi_env, napi_value, void *, napi_finalize, void *, napi_ref *);
extern napi_status napi_unwrap(napi_env, napi_value, void **);
extern napi_status napi_remove_wrap(napi_env, napi_value, void **);
extern napi_status napi_add_finalizer(napi_env, napi_value, void *, napi_finalize, void *, napi_ref *);
extern napi_status napi_create_external(napi_env, void *, napi_finalize, void *, napi_value *);

static int wrapData, wrapHint, addData1, addHint1, addData2, addHint2, extData, extHint, exitData;
static int wrapCalls, addCalls, extCalls, bad;

static void onWrap(napi_env env, void *data, void *hint) {
  (void)env;
  wrapCalls++;
  if (data != &wrapData || hint != &wrapHint) bad++;
}
static void onAdd(napi_env env, void *data, void *hint) {
  (void)env;
  addCalls++;
  if (!((data == &addData1 && hint == &addHint1) || (data == &addData2 && hint == &addHint2))) bad++;
}
static void onExternal(napi_env env, void *data, void *hint) {
  (void)env;
  extCalls++;
  if (data != &extData || hint != &extHint) bad++;
}
// Runs at environment teardown, after the script's last line, so the only way
// to show it ran is to write straight to fd 1.
static void onExit(napi_env env, void *data, void *hint) {
  (void)env; (void)hint;
  const char *msg = data == &exitData ? "exit finalizer ran\n" : "exit finalizer bad data\n";
  ssize_t w = write(1, msg, strlen(msg));
  (void)w;
}

static napi_value arg0(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1] = {0};
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  return argv[0];
}
static napi_value i32(napi_env env, int v) {
  napi_value out;
  napi_create_int32(env, v, &out);
  return out;
}

static napi_value makeWrapped(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value obj;
  napi_create_object(env, &obj);
  napi_wrap(env, obj, &wrapData, onWrap, &wrapHint, NULL);
  return obj;
}
static napi_value wrapTwice(napi_env env, napi_callback_info info) {
  // a second napi_wrap on a wrapped object is napi_invalid_arg in node
  return i32(env, napi_wrap(env, arg0(env, info), &wrapData, onWrap, &wrapHint, NULL));
}
static napi_value makeMulti(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value obj;
  napi_create_object(env, &obj);
  napi_add_finalizer(env, obj, &addData1, onAdd, &addHint1, NULL);
  napi_add_finalizer(env, obj, &addData2, onAdd, &addHint2, NULL);
  return obj;
}
static napi_value makeExternal(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value ext;
  napi_create_external(env, &extData, onExternal, &extHint, &ext);
  return ext;
}
static napi_value makeExitWrapped(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value obj;
  napi_create_object(env, &obj);
  napi_wrap(env, obj, &exitData, onExit, NULL, NULL);
  return obj;
}
static napi_value removeWrap(napi_env env, napi_callback_info info) {
  void *data = NULL;
  napi_status st = napi_remove_wrap(env, arg0(env, info), &data);
  napi_value out;
  napi_get_boolean(env, st == 0 && data == &wrapData, &out);
  return out;
}
static napi_value unwrapStatus(napi_env env, napi_callback_info info) {
  void *data = NULL;
  return i32(env, napi_unwrap(env, arg0(env, info), &data));
}
static napi_value counts(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value obj;
  napi_create_object(env, &obj);
  napi_set_named_property(env, obj, "wrap", i32(env, wrapCalls));
  napi_set_named_property(env, obj, "add", i32(env, addCalls));
  napi_set_named_property(env, obj, "external", i32(env, extCalls));
  napi_set_named_property(env, obj, "bad", i32(env, bad));
  return obj;
}

static void def(napi_env env, napi_value exports, const char *name, napi_callback cb) {
  napi_value fn;
  napi_create_function(env, name, (size_t)-1, cb, NULL, &fn);
  napi_set_named_property(env, exports, name, fn);
}
napi_value napi_register_module_v1(napi_env env, napi_value exports) {
  def(env, exports, "makeWrapped", makeWrapped);
  def(env, exports, "wrapTwice", wrapTwice);
  def(env, exports, "makeMulti", makeMulti);
  def(env, exports, "makeExternal", makeExternal);
  def(env, exports, "makeExitWrapped", makeExitWrapped);
  def(env, exports, "removeWrap", removeWrap);
  def(env, exports, "unwrapStatus", unwrapStatus);
  def(env, exports, "counts", counts);
  return exports;
}
