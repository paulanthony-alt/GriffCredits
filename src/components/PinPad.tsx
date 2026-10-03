import { PIN_MAX_LENGTH } from "../pin";

interface Props {
  value: string;
  onChange: (pin: string) => void;
  disabled?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

/** Big on-screen keypad so the app works on a tablet behind the bar. */
export default function PinPad({ value, onChange, disabled }: Props) {
  function press(key: string) {
    if (key === "clear") onChange("");
    else if (key === "back") onChange(value.slice(0, -1));
    else if (value.length < PIN_MAX_LENGTH) onChange(value + key);
  }

  return (
    <div className="pinpad">
      <div className="pin-dots" aria-label={`${value.length} digits entered`}>
        {Array.from({ length: PIN_MAX_LENGTH }, (_, i) => (
          <span key={i} className={i < value.length ? "dot filled" : "dot"} />
        ))}
      </div>
      <div className="pin-keys">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={key.length > 1 ? "pin-key secondary" : "pin-key"}
            disabled={disabled}
            onClick={() => press(key)}
          >
            {key === "clear" ? "Clear" : key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
    </div>
  );
}
