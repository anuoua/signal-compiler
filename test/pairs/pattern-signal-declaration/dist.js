import { signal as _signal, computed as _computed } from "source";
let __$0 = _computed(() => ({}));
let $p = _signal((__$0.value["a"] ?? 3)["p"]);
let $cc = _signal(((__$0.value["a"] ?? 3)["$ddd"] ?? 8)["c"]["1"]);
let $bb = _signal(((__$0.value["a"] ?? 3)["$ddd"] ?? 8)["b"]["0"]);
const __$1 = _computed(() => ({}));
const $rest2 = _computed(() => (() => {
  const {
    he,
    he2,
    $ki: ___2,
    ...___3
  } = __$1.value["b"];
  return ___3;
})());
const $ki = _computed(() => __$1.value["b"]["$ki"]);
const $he2 = _computed(() => __$1.value["b"]["he2"]);
const he = __$1.value["b"]["he"];
const $rest = _computed(() => __$1.value["a"].slice(1));
const $aaa = _computed(() => __$1.value["a"]["0"]);
const Pagination = $props => {
  const __$2 = _computed(() => $props.value);
  const $size = _computed(() => __$2.value["size"] ?? 'md');
};
const Input = __$3 => {
  const rest = (() => {
    const {
      size,
      ...___1
    } = __$3.value;
    return ___1;
  })();
  const $size = _computed(() => __$3.value["size"] ?? 'md');
};
