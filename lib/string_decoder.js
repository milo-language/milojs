// node:string_decoder — decodes byte chunks to strings. Multi-byte sequences
// split across chunk boundaries are not stitched; the target only decodes whole
// bodies, and doing it properly needs the partial-sequence state machine.
var Buffer = require('buffer').Buffer;

function StringDecoder(encoding) {
  // node normalises the name and rejects one it does not know, rather than
  // storing it and failing later inside toString(). An unknown encoding here
  // used to survive construction and produce wrong bytes at the first write.
  if (encoding !== undefined && encoding !== null) {
    if (typeof encoding !== 'string') {
      throw require('_errors').ERR_UNKNOWN_ENCODING(encoding);
    }
    var e = String(encoding).toLowerCase();
    var known = ['utf8', 'utf-8', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le',
                 'latin1', 'binary', 'base64', 'base64url', 'hex', 'ascii'];
    if (known.indexOf(e) < 0) throw require('_errors').ERR_UNKNOWN_ENCODING(encoding);
  }
  this.encoding = encoding || 'utf8';
}
StringDecoder.prototype.write = function (chunk) {
  if (chunk == null) return '';
  if (typeof chunk === 'string') return chunk;
  return Buffer.from(chunk).toString(this.encoding);
};
StringDecoder.prototype.end = function (chunk) {
  return chunk == null ? '' : this.write(chunk);
};

exports.StringDecoder = StringDecoder;
