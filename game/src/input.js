// Keyboard + mouse input. One job: turn browser events into a clean queryable
// state (held keys, just-pressed edges, mouse position and clicks) for main.js.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.canvas = canvas;
    this.onFirstGesture = null;
    this._gestured = false;
    this._onKeyDown = (event) => {
      const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
      if (gameKeys.includes(event.code) || gameKeys.includes(event.key)) {
        event.preventDefault();
      }
      if (!event.repeat) {
        this.keys.add(event.code);
        this.justPressed.add(event.code);
      }
      this._gesture();
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
    };
    this._onMouseDown = (event) => {
      this._onMouseMove(event);
      this.mouse.down = true;
      this.mouse.clicked = true;
      this._gesture();
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  _gesture() {
    if (!this._gestured) {
      this._gestured = true;
      if (typeof this.onFirstGesture === 'function') this.onFirstGesture();
    }
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.justPressed.has(code);
  }

  anyPressed(codes) {
    return codes.some((code) => this.justPressed.has(code));
  }

  axis(negCode, posCode) {
    let value = 0;
    if (this.down(negCode)) value -= 1;
    if (this.down(posCode)) value += 1;
    return value;
  }

  // Call once per frame after the game has read the edges.
  endFrame() {
    this.justPressed.clear();
    this.mouse.clicked = false;
  }
}
