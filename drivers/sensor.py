import serial
import serial.tools.list_ports
import time

arduino_port = '/dev/ttyACM0'
serial_hz = 9600

ser = serial.Serial(arduino_port, serial_hz, timeout=1)
ser.reset_input_buffer()

def get_sensor_data(command: bytes, retries: int = 3):
    for i in range(retries):
        try:
            # Clear input buffer first
            ser.reset_input_buffer()
            # Send command
            ser.write(command + b'\n')
            # Read response
            line = ser.readline().decode('utf-8').strip()
            if line:
                return line
        except Exception as e:
            if i == retries - 1:
                raise e
    raise RuntimeError(f"No response from Arduino for command: {command.decode()}")

# 0  ~300     dry soil
# 300~700     humid soil
# 700~950     in water
def get_soil_sensor_data():
    return get_sensor_data(b'GETSOIL')

# Returns atmospheric pressure in kilopascals
def get_pressure_sensor_data():
    return get_sensor_data(b'PRESS')

# Returns temperature in degrees Celsius (°C).
def get_temperature_sensor_data():
    raw_temp = float(get_sensor_data(b'TEMP'))
    return str(raw_temp)

if __name__ == '__main__':
    while True:
        soil_data = get_soil_sensor_data()
        pressure_data = get_pressure_sensor_data()
        temperature_data = get_temperature_sensor_data()

        print(f"Temperature Sensor Data: {temperature_data}")
        print(f"Soil Sensor Data: {soil_data}")
        print(f"Pressure Sensor Data: {pressure_data}")

        time.sleep(1)  # 每1秒获取一次数据

