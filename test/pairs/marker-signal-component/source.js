// jsx-transform 已把 JSX 转成 getter 形式，函数值属性带 @signal-component 标记
const Comp = () => ({
  get Title() {
    return /* @signal-component */ ({ msg: $msg, ...$rest }) => {
      return $msg;
    };
  },
  get Row() {
    return /* @signal-component */ ({ id: $id }) => $id;
  },
  get Noop() {
    return /* @signal-component */ ({ id }) => id;
  },
});
// 优先级：$use* Hook > 组件 > 标记 —— Hook 带标记仍是 Hook（返回值包 computed）
const $useFoo = /* @signal-component */ ({ x: $x }) => $x + 1;
