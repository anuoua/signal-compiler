import { computed as _computed } from "source";
// jsx-transform 已把 JSX 转成 getter 形式，函数值属性带 @signal-component 标记
const Comp = () => ({
  get Title() {
    return /* @signal-component */__$0 => {
      const $rest = _computed(() => (() => {
        const {
          msg,
          ...___1
        } = __$0.value;
        return ___1;
      })());
      const $msg = _computed(() => __$0.value["msg"]);
      return $msg.value;
    };
  },
  get Row() {
    return /* @signal-component */__$1 => {
      const $id = _computed(() => __$1.value["id"]);
      return $id.value;
    };
  },
  get Noop() {
    return /* @signal-component */({
      id
    }) => id;
  }
});
// 优先级：$use* Hook > 组件 > 标记 —— Hook 带标记仍是 Hook（返回值包 computed）
const $useFoo = /* @signal-component */__$2 => {
  const $x = _computed(() => __$2.value["x"]);
  return _computed(() => $x.value + 1);
};
