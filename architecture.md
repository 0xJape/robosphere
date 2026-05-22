HomeGuard is a web-based IoT system that monitors home environmental conditions in real time and provides intelligent safety assistance.

An ESP32 device collects sensor data such as temperature, humidity, gas, smoke, and flame detection, and sends it to a Node.js backend. The backend processes this data, checks for possible hazards, and stores all records in a SQLite database, which is a lightweight and efficient local storage solution for sensor data, alerts, and chatbot logs.

When unsafe conditions are detected, the system automatically generates alerts and sends real-time updates to the dashboard.

The system also includes an AI chatbot powered by the Gemini API, which serves two main purposes:

Home Safety Guidance – provides tips on home safety, environmental monitoring, and recommendations for maintaining a healthy home environment
Risk Assessment – analyzes sensor data and explains the level of danger, giving warnings and safety recommendations for home occupants

On the user side, a React frontend displays real-time sensor readings, alerts, and a map visualization for better awareness of home conditions.

Overall, HomeGuard combines real-time monitoring, SQLite-based data storage, and AI assistance to create a system that helps users maintain a safe and healthy home environment.