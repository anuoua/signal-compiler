import { signal as _signal, computed as _computed } from "source";
const $useClip = __$0 => {
  const $rest = _computed(() => (() => {
    const {
      x,
      y,
      ...__$2
    } = __$0.value;
    return __$2;
  })());
  const $y = _computed(() => __$0["y"]);
  const $x = _computed(() => __$0["x"]);
  return _computed(() => ({
    $x: $x.value
  }));
};
const $useCount = () => _computed(() => $k.value);
function $useClip2(__$1) {
  const $rest = _computed(() => (() => {
    const {
      x,
      y,
      ...__$2
    } = __$1.value;
    return __$2;
  })());
  const $y = _computed(() => __$1.value["y"]);
  const $x = _computed(() => __$1.value["x"]);
  return _computed(() => ({
    $x: $x.value
  }));
}
const $useClip3 = ($x, $y) => {};
const __$2 = $useClip3(_computed(() => $a.value + 1), _computed(() => $b.value));
const $k = _computed(() => __$2.value["k"]);
const $pg = $usePagination(_computed(() => ({
  ...$a.value
})));