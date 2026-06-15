import RPi.GPIO as GPIO

GPIO.setmode(GPIO.BCM)
GPIO.cleanup()
GPIO.setup(26, GPIO.OUT)

def pump_on():
    GPIO.output(26, GPIO.HIGH)

def pump_off():
    GPIO.output(26, GPIO.LOW)

if __name__ == "__main__":
    try:
        while True:
            command = input("Enter 'on' to turn on the pump, 'off' to turn it off, or 'exit' to quit: ").strip().lower()
            if command == 'on':
                pump_on()
                print("Pump turned ON.")
            elif command == 'off':
                pump_off()
                print("Pump turned OFF.")
            elif command == 'exit':
                break
            else:
                print("Invalid command. Please enter 'on', 'off', or 'exit'.")
    finally:
        GPIO.cleanup()