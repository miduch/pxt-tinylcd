enum LcdStyle {
    //% block="filled"
    Filled = 0,
    //% block="outline"
    Outline = 1
}

/**
 * Draw shapes, text and pictures on the Waveshare 1.8" LCD (160 x 128).
 */
//% weight=100 color="#ff6f00" icon="\uf108" block="Tiny LCD"
//% groups='["Screen", "Shapes", "Text", "Pictures", "Colors"]'
namespace tinylcd {
    const WIDTH = 160
    const HEIGHT = 128
    // ST7735S panel RAM is offset from the visible area in landscape mode
    const X_OFFSET = 1
    const Y_OFFSET = 2

    const PIN_CS = DigitalPin.P16
    const PIN_DC = DigitalPin.P12
    const PIN_RST = DigitalPin.P8
    const PIN_RAM_CS = DigitalPin.P2

    // Classic 5x7 font, ASCII 32..126, 5 column bytes per char, bit 0 = top row
    const FONT = hex`
        0000000000 00005f0000 0007000700 147f147f14 242a7f2a12 2313086462 3649562050 0008070300
        001c224100 0041221c00 2a1c7f1c2a 08083e0808 0080703000 0808080808 0000606000 2010080402
        3e5149453e 00427f4000 7249494946 2141494d33 1814127f10 2745454539 3c4a494931 4121110907
        3649494936 464949291e 0000140000 0040340000 0008142241 1414141414 0041221408 0201590906
        3e415d594e 7c1211127c 7f49494936 3e41414122 7f4141413e 7f49494941 7f09090901 3e41415173
        7f0808087f 00417f4100 2040413f01 7f08142241 7f40404040 7f021c027f 7f0408107f 3e4141413e
        7f09090906 3e4151215e 7f09192946 2649494932 03017f0103 3f4040403f 1f2040201f 3f4038403f
        6314081463 0304780403 6159494d43 007f414141 0204081020 004141417f 0402010204 4040404040
        0003070800 2054547840 7f28444438 3844444428 384444287f 3854545418 00087e0902 18a4a49c78
        7f08040478 00447d4000 2040403d00 7f10284400 00417f4000 7c04780478 7c08040478 3844444438
        fc18242418 18242418fc 7c08040408 4854545424 04043f4424 3c4040207c 1c2040201c 3c4030403c
        4428102844 4c9090907c 4464544c44 0008364100 0000770000 0041360800 0201020402
    `

    let started = false
    let chunk: Buffer = null
    let chunkColor = -1
    let glyph: Buffer = null
    let glyphSize = 0

    function command(cmd: number, data: number[]) {
        pins.digitalWritePin(PIN_DC, 0)
        pins.digitalWritePin(PIN_CS, 0)
        pins.spiWrite(cmd)
        if (data.length > 0) {
            pins.digitalWritePin(PIN_DC, 1)
            for (let b of data) pins.spiWrite(b)
        }
        pins.digitalWritePin(PIN_CS, 1)
    }

    function setWindow(x0: number, y0: number, x1: number, y1: number) {
        command(0x2A, [0, x0 + X_OFFSET, 0, x1 + X_OFFSET])
        command(0x2B, [0, y0 + Y_OFFSET, 0, y1 + Y_OFFSET])
        command(0x2C, [])
    }

    function beginData() {
        pins.digitalWritePin(PIN_DC, 1)
        pins.digitalWritePin(PIN_CS, 0)
    }

    function endData() {
        pins.digitalWritePin(PIN_CS, 1)
    }

    function to565(rgb: number): number {
        return ((rgb >> 8) & 0xF800) | ((rgb >> 5) & 0x07E0) | ((rgb >> 3) & 0x001F)
    }

    function fillChunk(c: number) {
        if (c == chunkColor) return
        chunkColor = c
        const hi = (c >> 8) & 0xff
        const lo = c & 0xff
        for (let i = 0; i < chunk.length; i += 2) {
            chunk[i] = hi
            chunk[i + 1] = lo
        }
    }

    function fillRectRaw(x: number, y: number, w: number, h: number, c: number) {
        x = x | 0
        y = y | 0
        w = w | 0
        h = h | 0
        if (x < 0) { w += x; x = 0 }
        if (y < 0) { h += y; y = 0 }
        if (x + w > WIDTH) w = WIDTH - x
        if (y + h > HEIGHT) h = HEIGHT - y
        if (w <= 0 || h <= 0) return

        setWindow(x, y, x + w - 1, y + h - 1)
        fillChunk(c)
        let bytes = w * h * 2
        beginData()
        while (bytes >= chunk.length) {
            pins.spiTransfer(chunk, null)
            bytes -= chunk.length
        }
        if (bytes > 0) pins.spiTransfer(chunk.slice(0, bytes), null)
        endData()
    }

    function pixelRaw(x: number, y: number, c: number) {
        if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return
        setWindow(x, y, x, y)
        beginData()
        pins.spiWrite((c >> 8) & 0xff)
        pins.spiWrite(c & 0xff)
        endData()
    }

    function drawChar(code: number, x: number, y: number, size: number, fg: number, bg: number) {
        const w = 6 * size
        const h = 8 * size
        if (x < 0 || y < 0 || x + w > WIDTH || y + h > HEIGHT) return
        if (code < 32 || code > 126) code = 63

        if (glyphSize != size) {
            glyph = pins.createBuffer(w * h * 2)
            glyphSize = size
        }

        const base = (code - 32) * 5
        const rowBytes = w * 2
        for (let r = 0; r < 8; r++) {
            const lineStart = r * size * rowBytes
            let off = lineStart
            for (let col = 0; col < 6; col++) {
                const bits = col < 5 ? FONT[base + col] : 0
                const c = (bits >> r) & 1 ? fg : bg
                const hi = (c >> 8) & 0xff
                const lo = c & 0xff
                for (let k = 0; k < size; k++) {
                    glyph[off++] = hi
                    glyph[off++] = lo
                }
            }
            if (size > 1) {
                const line = glyph.slice(lineStart, rowBytes)
                for (let k = 1; k < size; k++) glyph.write(lineStart + k * rowBytes, line)
            }
        }

        setWindow(x, y, x + w - 1, y + h - 1)
        beginData()
        pins.spiTransfer(glyph, null)
        endData()
    }

    function ensure(): boolean {
        if (!started) start()
        return true
    }

    /**
     * Get the screen ready. Other blocks do this automatically, but it is nice to put it in "on start".
     */
    //% blockId=tinylcd_start block="start screen"
    //% group="Screen" weight=100
    export function start() {
        if (started) return
        started = true
        chunk = pins.createBuffer(640)

        pins.digitalWritePin(PIN_RAM_CS, 1)
        pins.digitalWritePin(PIN_CS, 1)
        pins.spiPins(DigitalPin.P15, DigitalPin.P14, DigitalPin.P13)
        pins.spiFormat(8, 0)
        pins.spiFrequency(16000000)

        pins.digitalWritePin(PIN_RST, 1)
        basic.pause(5)
        pins.digitalWritePin(PIN_RST, 0)
        basic.pause(20)
        pins.digitalWritePin(PIN_RST, 1)
        basic.pause(120)

        command(0x11, []) // sleep out
        basic.pause(120)
        command(0xB1, [0x01, 0x2C, 0x2D])
        command(0xB2, [0x01, 0x2C, 0x2D])
        command(0xB3, [0x01, 0x2C, 0x2D, 0x01, 0x2C, 0x2D])
        command(0xB4, [0x07])
        command(0xC0, [0xA2, 0x02, 0x84])
        command(0xC1, [0xC5])
        command(0xC2, [0x0A, 0x00])
        command(0xC3, [0x8A, 0x2A])
        command(0xC4, [0x8A, 0xEE])
        command(0xC5, [0x0E])
        command(0xE0, [0x0F, 0x1A, 0x0F, 0x18, 0x2F, 0x28, 0x20, 0x22, 0x1F, 0x1B, 0x23, 0x37, 0x00, 0x07, 0x02, 0x10])
        command(0xE1, [0x0F, 0x1B, 0x0F, 0x17, 0x33, 0x2C, 0x29, 0x2E, 0x30, 0x30, 0x39, 0x3F, 0x00, 0x07, 0x03, 0x10])
        command(0xF0, [0x01])
        command(0xF6, [0x00])
        command(0x3A, [0x05]) // 16-bit colour
        command(0x36, [0xA0]) // landscape
        command(0x29, []) // display on

        fillRectRaw(0, 0, WIDTH, HEIGHT, 0)
        pins.digitalWritePin(DigitalPin.P1, 1)
    }

    /**
     * Fill the whole screen with one colour.
     */
    //% blockId=tinylcd_clear block="fill screen with $color"
    //% color.shadow="tinylcd_colorPicker" color.defl=0x000000
    //% group="Screen" weight=95
    export function clearScreen(color: number = 0x000000) {
        if (!ensure()) return
        fillRectRaw(0, 0, WIDTH, HEIGHT, to565(color))
    }

    /**
     * Make the screen brighter or darker. 0 turns the light off.
     */
    //% blockId=tinylcd_brightness block="set screen brightness $percent"
    //% percent.min=0 percent.max=100 percent.defl=100
    //% group="Screen" weight=90
    export function setBrightness(percent: number) {
        if (!ensure()) return
        pins.analogWritePin(AnalogPin.P1, Math.map(Math.constrain(percent, 0, 100), 0, 100, 0, 1023))
    }

    //% blockId=tinylcd_width block="screen width"
    //% group="Screen" weight=85
    export function width(): number {
        return WIDTH
    }

    //% blockId=tinylcd_height block="screen height"
    //% group="Screen" weight=84
    export function height(): number {
        return HEIGHT
    }

    /**
     * Draw a rectangle. x and y are the top-left corner.
     */
    //% blockId=tinylcd_rect block="draw $style rectangle at x $x y $y width $width height $height color $color"
    //% x.min=0 x.max=159 y.min=0 y.max=127 width.defl=40 height.defl=30
    //% color.shadow="tinylcd_colorPicker" color.defl=0xff0000
    //% inlineInputMode=inline
    //% group="Shapes" weight=80
    export function drawRect(x: number, y: number, width: number, height: number, color: number, style: LcdStyle = LcdStyle.Filled) {
        if (!ensure()) return
        const c = to565(color)
        if (style == LcdStyle.Filled) {
            fillRectRaw(x, y, width, height, c)
        } else {
            fillRectRaw(x, y, width, 1, c)
            fillRectRaw(x, y + height - 1, width, 1, c)
            fillRectRaw(x, y, 1, height, c)
            fillRectRaw(x + width - 1, y, 1, height, c)
        }
    }

    /**
     * Draw a circle. x and y are the middle.
     */
    //% blockId=tinylcd_circle block="draw $style circle at x $x y $y radius $radius color $color"
    //% x.min=0 x.max=159 y.min=0 y.max=127 radius.defl=10 radius.min=1 radius.max=64
    //% color.shadow="tinylcd_colorPicker" color.defl=0x00ff00
    //% inlineInputMode=inline
    //% group="Shapes" weight=75
    export function drawCircle(x: number, y: number, radius: number, color: number, style: LcdStyle = LcdStyle.Filled) {
        if (!ensure()) return
        const c = to565(color)
        x = x | 0
        y = y | 0
        radius = Math.abs(radius | 0)

        if (style == LcdStyle.Filled) {
            for (let dy = -radius; dy <= radius; dy++) {
                const half = Math.round(Math.sqrt(radius * radius - dy * dy))
                fillRectRaw(x - half, y + dy, 2 * half + 1, 1, c)
            }
            return
        }

        let f = 1 - radius
        let ddx = 1
        let ddy = -2 * radius
        let px = 0
        let py = radius
        pixelRaw(x, y + radius, c)
        pixelRaw(x, y - radius, c)
        pixelRaw(x + radius, y, c)
        pixelRaw(x - radius, y, c)
        while (px < py) {
            if (f >= 0) {
                py--
                ddy += 2
                f += ddy
            }
            px++
            ddx += 2
            f += ddx
            pixelRaw(x + px, y + py, c)
            pixelRaw(x - px, y + py, c)
            pixelRaw(x + px, y - py, c)
            pixelRaw(x - px, y - py, c)
            pixelRaw(x + py, y + px, c)
            pixelRaw(x - py, y + px, c)
            pixelRaw(x + py, y - px, c)
            pixelRaw(x - py, y - px, c)
        }
    }

    /**
     * Draw a straight line between two points.
     */
    //% blockId=tinylcd_line block="draw line from x $x0 y $y0 to x $x1 y $y1 color $color"
    //% x0.min=0 x0.max=159 y0.min=0 y0.max=127 x1.min=0 x1.max=159 y1.min=0 y1.max=127
    //% x1.defl=159 y1.defl=127
    //% color.shadow="tinylcd_colorPicker" color.defl=0xffffff
    //% inlineInputMode=inline
    //% group="Shapes" weight=70
    export function drawLine(x0: number, y0: number, x1: number, y1: number, color: number) {
        if (!ensure()) return
        const c = to565(color)
        x0 = x0 | 0
        y0 = y0 | 0
        x1 = x1 | 0
        y1 = y1 | 0

        if (y0 == y1) {
            fillRectRaw(Math.min(x0, x1), y0, Math.abs(x1 - x0) + 1, 1, c)
            return
        }
        if (x0 == x1) {
            fillRectRaw(x0, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c)
            return
        }

        const dx = Math.abs(x1 - x0)
        const dy = -Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx + dy
        while (true) {
            pixelRaw(x0, y0, c)
            if (x0 == x1 && y0 == y1) break
            const e2 = 2 * err
            if (e2 >= dy) {
                err += dy
                x0 += sx
            }
            if (e2 <= dx) {
                err += dx
                y0 += sy
            }
        }
    }

    /**
     * Light up a single dot on the screen.
     */
    //% blockId=tinylcd_pixel block="draw dot at x $x y $y color $color"
    //% x.min=0 x.max=159 y.min=0 y.max=127
    //% color.shadow="tinylcd_colorPicker" color.defl=0xffffff
    //% inlineInputMode=inline
    //% group="Shapes" weight=65
    export function drawPixel(x: number, y: number, color: number) {
        if (!ensure()) return
        pixelRaw(x | 0, y | 0, to565(color))
    }

    /**
     * Show text. x and y are the top-left corner of the first letter.
     */
    //% blockId=tinylcd_text block="show text $text at x $x y $y||size $size color $color background $background"
    //% text.defl="Hello!" x.min=0 x.max=159 y.min=0 y.max=127
    //% size.min=1 size.max=5
    //% color.shadow="tinylcd_colorPicker" background.shadow="tinylcd_colorPicker"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Text" weight=60
    export function showText(text: string, x: number, y: number, size: number = 2, color: number = 0xffffff, background: number = 0x000000) {
        if (!ensure()) return
        size = Math.constrain(size | 0, 1, 5)
        const fg = to565(color)
        const bg = to565(background)
        let cx = x | 0
        for (let i = 0; i < text.length; i++) {
            drawChar(text.charCodeAt(i), cx, y | 0, size, fg, bg)
            cx += 6 * size
        }
    }

    /**
     * Show text in the middle of the screen (left to right).
     */
    //% blockId=tinylcd_text_center block="show text $text centered at y $y||size $size color $color background $background"
    //% text.defl="Hello!" y.min=0 y.max=127
    //% size.min=1 size.max=5
    //% color.shadow="tinylcd_colorPicker" background.shadow="tinylcd_colorPicker"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Text" weight=55
    export function showTextCentered(text: string, y: number, size: number = 2, color: number = 0xffffff, background: number = 0x000000) {
        showText(text, Math.idiv(WIDTH - textWidth(text, size), 2), y, size, color, background)
    }

    /**
     * Show a number. x and y are the top-left corner.
     */
    //% blockId=tinylcd_number block="show number $value at x $x y $y||size $size color $color background $background"
    //% x.min=0 x.max=159 y.min=0 y.max=127
    //% size.min=1 size.max=5
    //% color.shadow="tinylcd_colorPicker" background.shadow="tinylcd_colorPicker"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Text" weight=50
    export function showNumber(value: number, x: number, y: number, size: number = 2, color: number = 0xffffff, background: number = 0x000000) {
        showText("" + value, x, y, size, color, background)
    }

    /**
     * Draw a coloured box with text in the middle. Great for buttons and answers.
     */
    //% blockId=tinylcd_box block="draw box at x $x y $y width $width height $height color $color||text $text text color $textColor size $size"
    //% x.min=0 x.max=159 y.min=0 y.max=127 width.defl=70 height.defl=40
    //% size.min=1 size.max=5
    //% color.shadow="tinylcd_colorPicker" color.defl=0x0000ff textColor.shadow="tinylcd_colorPicker"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Text" weight=45
    export function drawBox(x: number, y: number, width: number, height: number, color: number, text: string = "", textColor: number = 0xffffff, size: number = 2) {
        drawRect(x, y, width, height, color, LcdStyle.Filled)
        if (text.length == 0) return
        size = Math.constrain(size | 0, 1, 5)
        const tx = x + Math.idiv(width - textWidth(text, size), 2)
        const ty = y + Math.idiv(height - 7 * size, 2)
        showText(text, tx, ty, size, textColor, color)
    }

    /**
     * How many pixels wide the text will be.
     */
    //% blockId=tinylcd_text_width block="width of text $text||size $size"
    //% size.min=1 size.max=5
    //% group="Text" weight=40 advanced=true
    export function textWidth(text: string, size: number = 2): number {
        if (text.length == 0) return 0
        size = Math.constrain(size | 0, 1, 5)
        return text.length * 6 * size - size
    }

    /**
     * Draw one of the micro:bit icons, made bigger.
     */
    //% blockId=tinylcd_icon block="draw icon $icon at x $x y $y||size $size color $color"
    //% icon.fieldEditor="imagedropdown" icon.fieldOptions.columns="5"
    //% icon.fieldOptions.width="380" icon.fieldOptions.maxRows=4
    //% x.min=0 x.max=159 y.min=0 y.max=127 size.min=1 size.max=24
    //% color.shadow="tinylcd_colorPicker"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Pictures" weight=35
    export function drawIcon(icon: IconNames, x: number, y: number, size: number = 8, color: number = 0xffff00) {
        drawImage(images.iconImage(icon), x, y, size, color)
    }

    /**
     * Draw a micro:bit image, made bigger. Each LED becomes a square of "size" pixels.
     */
    //% blockId=tinylcd_image block="draw image $img at x $x y $y||size $size color $color"
    //% x.min=0 x.max=159 y.min=0 y.max=127 size.min=1 size.max=24
    //% color.shadow="tinylcd_colorPicker"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Pictures" weight=30
    export function drawImage(img: Image, x: number, y: number, size: number = 8, color: number = 0xffffff) {
        if (!ensure()) return
        const c = to565(color)
        size = Math.max(1, size | 0)
        for (let row = 0; row < img.height(); row++) {
            for (let col = 0; col < img.width(); col++) {
                if (img.pixel(col, row)) fillRectRaw(x + col * size, y + row * size, size, size, c)
            }
        }
    }

    //% blockId=tinylcd_colorPicker block="$value" shim=TD_ID
    //% value.fieldEditor="colornumber" value.fieldOptions.decompileLiterals=true
    //% value.fieldOptions.colours='["#000000","#ffffff","#ff0000","#ff8000","#ffff00","#00ff00","#00ffff","#0000ff","#8000ff","#ff00ff","#ff80c0","#804000","#808080","#c0c0c0","#008000","#000080"]'
    //% value.fieldOptions.columns=4 value.fieldOptions.className='rgbColorPicker'
    //% colorSecondary="#FFFFFF" blockHidden=true
    export function colorPicker(value: number): number {
        return value
    }

    /**
     * Mix your own colour from red, green and blue (0 to 255).
     */
    //% blockId=tinylcd_rgb block="red $red green $green blue $blue"
    //% red.min=0 red.max=255 green.min=0 green.max=255 blue.min=0 blue.max=255
    //% red.defl=255 green.defl=128 blue.defl=0
    //% group="Colors" weight=20
    export function rgb(red: number, green: number, blue: number): number {
        return ((red & 0xff) << 16) | ((green & 0xff) << 8) | (blue & 0xff)
    }

    /**
     * Pick a random colour.
     */
    //% blockId=tinylcd_random_color block="random color"
    //% group="Colors" weight=15
    export function randomColor(): number {
        return rgb(randint(0, 255), randint(0, 255), randint(0, 255))
    }
}
