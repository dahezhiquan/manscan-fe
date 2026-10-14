/** 入口筛选仅接受已有枚举，兼容重复参数和逗号分隔，过滤空值并去重。 */
export function readEnumRouteFilter(search, key, options) {
  const allowed = new Set(options.flatMap(({ value }) => value.split(',')).filter(Boolean))
  const values = new URLSearchParams(search).getAll(key).flatMap((value) => value.split(','))
  return [...new Set(values.map((value) => value.trim()).filter((value) => allowed.has(value)))]
}
