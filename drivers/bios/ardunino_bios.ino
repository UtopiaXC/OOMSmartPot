#include <Wire.h>

#define MPL115A2_ADDR 0x60

// 避免与 A0/B1 冲突
float coef_a0, coef_b1, coef_b2, coef_c12;

// -------------------------
// 读取校准系数（只读一次）
// -------------------------
void mpl115a2_readCoefficients() {
  Wire.beginTransmission(MPL115A2_ADDR);
  Wire.write(0x04);
  Wire.endTransmission();

  if (Wire.requestFrom(MPL115A2_ADDR, (uint8_t)8) != 8) {
    Serial.println("ERR: coef read fail");
    return;
  }

  coef_a0  = ((Wire.read() << 8) | Wire.read()) / 8.0;
  coef_b1  = ((Wire.read() << 8) | Wire.read()) / 8192.0;
  coef_b2  = ((Wire.read() << 8) | Wire.read()) / 16384.0;
  coef_c12 = (((Wire.read() << 8) | Wire.read()) >> 2) / 4194304.0;
}

// -------------------------
// 读取压力（kPa）
// -------------------------
float readPressureMPL115A2() {
  // 启动转换
  Wire.beginTransmission(MPL115A2_ADDR);
  Wire.write(0x12);
  Wire.write(0x00);
  Wire.endTransmission();
  delay(5);

  // 读取原始 ADC
  Wire.beginTransmission(MPL115A2_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();

  if (Wire.requestFrom(MPL115A2_ADDR, (uint8_t)4) != 4) {
    Serial.println("ERR: ADC read fail");
    return -1;
  }

  uint16_t Padc16 = (Wire.read() << 8) | Wire.read();
  uint16_t Tadc16 = (Wire.read() << 8) | Wire.read();

  uint16_t Padc = Padc16 >> 6;  // 取高 10 位
  uint16_t Tadc = Tadc16 >> 6;  // 取高 10 位

  float Pcomp = coef_a0 + (coef_b1 + coef_c12 * Tadc) * Padc + coef_b2 * Tadc;
  float pressure_kPa = (Pcomp * 65.0 / 1023.0) + 50.0;

  return pressure_kPa;
}

// -------------------------
// 读取温度（摄氏度）
// -------------------------
float mpl115a2_readTemperature() {
  // 启动转换
  Wire.beginTransmission(MPL115A2_ADDR);
  Wire.write(0x12);
  Wire.write(0x00);
  Wire.endTransmission();
  delay(5);

  Wire.beginTransmission(MPL115A2_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();

  if (Wire.requestFrom(MPL115A2_ADDR, (uint8_t)4) != 4) {
    Serial.println("ERR: ADC read fail");
    return -1000;
  }

  uint16_t Padc16 = (Wire.read() << 8) | Wire.read();
  uint16_t Tadc16 = (Wire.read() << 8) | Wire.read();

  uint16_t Tadc = Tadc16 >> 6;

  float tempC = (Tadc / 1023.0) * 200.0 - 50.0;
  return tempC;
}

// -------------------------
// 土壤传感器
// -------------------------
void get_soil_data() {
  uint8_t a0 = analogRead(A0);
  Serial.println(a0);
}

// -------------------------
// 主程序
// -------------------------
void setup() {
  Serial.begin(9600);
  Wire.begin();

  mpl115a2_readCoefficients();  // 只需读一次
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "GETSOIL") {
      get_soil_data();
    }
    else if (command == "VERSION") {
      Serial.println(__TIMESTAMP__);
    }
    else if (command == "PRESS") {
      Serial.println(readPressureMPL115A2());
    }
    else if (command == "TEMP") {
      Serial.println(mpl115a2_readTemperature());
    }
  }
}
