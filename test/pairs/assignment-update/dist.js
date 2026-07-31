import { signal as _signal } from "source";
let $a = _signal(1),
  $b = _signal(2);
$a.value++;
++$a.value;
$a.value += 1;
({
  $a: $a.value,
  k: $b.value
} = obj);
[$a.value, $b.value] = arr;
