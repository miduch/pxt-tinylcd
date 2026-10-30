# Tiny LCD

MakeCode blocks for the [Waveshare 1.8" LCD for micro:bit](https://www.waveshare.com/wiki/1.8inch_LCD_for_micro:bit) (ST7735S, 160 x 128 pixels).

## Use as Extension

1. Open [https://makecode.microbit.org/](https://makecode.microbit.org/) and create a new project.
2. Click **Extensions** under the gearwheel menu.
3. Paste the GitHub URL of this repository and import it.

## Blocks

| Group | Blocks |
| --- | --- |
| Screen | start screen, fill screen, set brightness, screen width / height |
| Shapes | rectangle and circle (filled or outline), line, dot |
| Text | show text, show text centered, show number, box with text, width of text |
| Pictures | draw any micro:bit icon or image, scaled up |
| Colors | color picker, mix red / green / blue, random color |

The screen is 160 pixels wide and 128 pixels tall. `x = 0, y = 0` is the top-left corner.
Text comes in sizes 1 to 5; every letter is `6 x size` pixels wide and `8 x size` pixels tall.

## Example: Math Stars

Ten math questions that get harder as you go. Press **A** for the left answer and **B** for the right answer.

```blocks
let questionNumber = 0
let score = 0
let answer = 0
let wrong = 0
let first = 0
let second = 0
let level = 0
let maxNumber = 0
let operation = 0
let symbol = ""
let correctIsA = false
let waiting = false
let gameOver = false
let praise = ["GREAT!", "SUPER!", "WOW!", "YES!", "COOL!", "AWESOME"]

function nextQuestion () {
    questionNumber += 1
    basic.clearScreen()
    level = Math.min(Math.idiv(questionNumber - 1, 4), 2)
    maxNumber = 10
    if (level == 1) {
        maxNumber = 20
    } else if (level == 2) {
        maxNumber = 50
    }
    operation = randint(0, 2)
    if (level == 0) {
        operation = randint(0, 1)
    }
    if (operation == 0) {
        first = randint(1, maxNumber)
        second = randint(1, maxNumber)
        answer = first + second
        symbol = "+"
    } else if (operation == 1) {
        first = randint(1, maxNumber)
        second = randint(0, first)
        answer = first - second
        symbol = "-"
    } else {
        first = randint(2, 5)
        if (level == 2) {
            first = randint(2, 10)
        }
        second = randint(2, 10)
        answer = first * second
        symbol = "x"
    }
    wrong = answer
    while (wrong == answer || wrong < 0) {
        wrong = answer + randint(-3, 3)
    }
    correctIsA = Math.randomBoolean()
    tinylcd.clearScreen(0x000000)
    tinylcd.showText("Q" + questionNumber + "/10", 4, 4, 1, 0xffffff, 0x000000)
    tinylcd.showText("Stars:" + score, 100, 4, 1, 0xffff00, 0x000000)
    tinylcd.showTextCentered("" + first + " " + symbol + " " + second + " = ?", 35, 2, 0x00ffff, 0x000000)
    if (correctIsA) {
        tinylcd.drawBox(5, 75, 70, 45, 0xff0000, "" + answer, 0xffffff, 3)
        tinylcd.drawBox(85, 75, 70, 45, 0x0000ff, "" + wrong, 0xffffff, 3)
    } else {
        tinylcd.drawBox(5, 75, 70, 45, 0xff0000, "" + wrong, 0xffffff, 3)
        tinylcd.drawBox(85, 75, 70, 45, 0x0000ff, "" + answer, 0xffffff, 3)
    }
    tinylcd.showText("A", 8, 78, 1, 0xffffff, 0xff0000)
    tinylcd.showText("B", 88, 78, 1, 0xffffff, 0x0000ff)
    waiting = true
}

function check (pickedA: boolean) {
    if (waiting) {
        waiting = false
        if (pickedA == correctIsA) {
            score += 1
            tinylcd.clearScreen(0x00c000)
            tinylcd.showTextCentered(praise._pickRandom(), 50, 3, 0xffffff, 0x00c000)
            music.play(music.builtinPlayableSoundEffect(soundExpression.happy), music.PlaybackMode.InBackground)
            basic.showIcon(IconNames.Yes)
        } else {
            tinylcd.clearScreen(0xc00000)
            tinylcd.showTextCentered("Oops!", 30, 3, 0xffffff, 0xc00000)
            tinylcd.showTextCentered("Answer: " + answer, 80, 2, 0xffff00, 0xc00000)
            music.play(music.builtinPlayableSoundEffect(soundExpression.sad), music.PlaybackMode.InBackground)
            basic.showIcon(IconNames.No)
        }
        basic.pause(1500)
        if (questionNumber < 10) {
            nextQuestion()
        } else {
            showResult()
        }
    }
}

function showResult () {
    tinylcd.clearScreen(0x000000)
    tinylcd.showTextCentered("You got", 10, 2, 0xffffff, 0x000000)
    tinylcd.showTextCentered("" + score + "/10", 35, 3, 0xffff00, 0x000000)
    for (let index = 0; index <= score - 1; index++) {
        tinylcd.drawCircle(10 + index * 15, 80, 5, 0xffff00, LcdStyle.Filled)
    }
    if (score == 10) {
        tinylcd.showTextCentered("MATH SUPERSTAR!", 98, 1, 0x00ffff, 0x000000)
    } else if (score >= 7) {
        tinylcd.showTextCentered("Great job!", 98, 1, 0x00ffff, 0x000000)
    } else if (score >= 4) {
        tinylcd.showTextCentered("Good try!", 98, 1, 0x00ffff, 0x000000)
    } else {
        tinylcd.showTextCentered("Keep practicing!", 98, 1, 0x00ffff, 0x000000)
    }
    tinylcd.showTextCentered("Press A or B", 115, 1, 0xffffff, 0x000000)
    basic.showIcon(IconNames.Happy)
    music.play(music.builtInPlayableMelody(Melodies.PowerUp), music.PlaybackMode.InBackground)
    gameOver = true
}

function startGame () {
    gameOver = false
    questionNumber = 0
    score = 0
    tinylcd.clearScreen(0x000080)
    tinylcd.showTextCentered("MATH STARS", 30, 2, 0xffff00, 0x000080)
    tinylcd.showTextCentered("A = left  B = right", 70, 1, 0xffffff, 0x000080)
    tinylcd.showTextCentered("Get ready...", 95, 1, 0xffffff, 0x000080)
    basic.pause(2000)
    nextQuestion()
}

input.onButtonPressed(Button.A, function () {
    if (gameOver) {
        startGame()
    } else {
        check(true)
    }
})

input.onButtonPressed(Button.B, function () {
    if (gameOver) {
        startGame()
    } else {
        check(false)
    }
})

tinylcd.start()
startGame()
```

## Wiring

The Waveshare board plugs straight into the micro:bit edge connector and uses:

| Signal | micro:bit pin |
| --- | --- |
| SPI clock | P13 |
| SPI data (MOSI) | P15 |
| SPI data (MISO) | P14 |
| LCD chip select | P16 |
| Data / command | P12 |
| Reset | P8 |
| Backlight | P1 |
| SRAM chip select (kept off) | P2 |

## License

MIT

## Supported targets

* for PXT/microbit
