export const NUMPAD_REMAPS = [
  {
    from: { key_code: "keypad_asterisk" },
    to: [{ key_code: "keypad_hyphen" }],
  },
  {
    from: { key_code: "keypad_equal_sign" },
    to: [{ key_code: "keypad_slash" }],
  },
  {
    from: { key_code: "keypad_hyphen" },
    to: [{ key_code: "keypad_plus" }],
  },
  {
    from: { key_code: "keypad_plus" },
    to: [{ key_code: "keypad_equal_sign" }],
  },
  {
    from: { key_code: "keypad_slash" },
    to: [{ key_code: "keypad_asterisk" }],
  },
  { from: { key_code: "left_control" }, to: [{ key_code: "fn" }] },
  { from: { key_code: "fn" }, to: [{ key_code: "left_control" }] },
] as const;

export const SWAP_CTRL_FN = [
  {
    from: { key_code: "fn" },
    to: [{ key_code: "left_control" }],
  },
  {
    from: { key_code: "left_control" },
    to: [{ key_code: "fn" }],
  },
] as const;