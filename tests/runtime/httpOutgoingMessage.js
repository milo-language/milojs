// http.OutgoingMessage is the base of ServerResponse and ClientRequest, and it
// did not exist: twelve of node's http tests construct one directly and died on
// `new OutgoingMessage()` not being a constructor. Its validation is the point —
// each rejection below carries a code node's tests assert.
const http = require('http');
const OutgoingMessage = http.OutgoingMessage;
const t = (l, f) => { try { f(); console.log(l, 'NO THROW'); } catch (e) { console.log(l, e.code, '|', e.message); } };

t('setHeader()', () => new OutgoingMessage().setHeader());
t("setHeader('test')", () => new OutgoingMessage().setHeader('test'));
t('setHeader(404)', () => new OutgoingMessage().setHeader(404));
t('setHeader after sent', () => OutgoingMessage.prototype.setHeader.call({ _header: 'test' }, 'test', 'v'));
t("setHeader('200','あ')", () => new OutgoingMessage().setHeader('200', 'あ'));
t("write('') with no _implicitHeader", () => new OutgoingMessage().write(''));
t('write undefined chunk', () => OutgoingMessage.prototype.write.call({ _header: 'h', _hasBody: 'b' }));
t('write number chunk', () => OutgoingMessage.prototype.write.call({ _header: 'h', _hasBody: 'b' }, 1));
t('write null chunk', () => OutgoingMessage.prototype.write.call({ _header: 'h', _hasBody: 'b' }, null));
t('addTrailers()', () => new OutgoingMessage().addTrailers());
t('addTrailers bad name', () => new OutgoingMessage().addTrailers({ 'あ': 'v' }));
t('addTrailers bad value', () => new OutgoingMessage().addTrailers({ x: 'あ' }));

const m = new OutgoingMessage();
m.setHeader('X-Foo', 'bar');
m.appendHeader('X-Foo', 'baz');
console.log(m.getHeaderNames(), m.getHeader('x-foo'), m.hasHeader('X-FOO'), m.writableObjectMode, m.writableCorked);
m.removeHeader('X-Foo');
console.log(m.getHeaderNames(), m.hasHeader('x-foo'));
console.log(typeof http.ServerResponse.prototype._implicitHeader, typeof http.ClientRequest.prototype._implicitHeader);
console.log(new http.ServerResponse(0) instanceof OutgoingMessage);
