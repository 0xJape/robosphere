RoboSphere is a web-based IoT system that monitors environmental conditions in real time and provides intelligent assistance for robotics.

An ESP32 device collects sensor data such as temperature, humidity, gas, and smoke, and sends it to a Node.js backend. The backend processes this data, checks for possible hazards, and stores all records in a SQLite database, which is a lightweight and efficient local storage solution for sensor data, alerts, and chatbot logs.

When unsafe conditions are detected, the system automatically generates alerts and sends real-time updates to the dashboard.

The system also includes an AI chatbot powered by the Gemini API, which serves two main purposes:

Robotics Guidance – suggests project ideas and provides step-by-step instructions with required materials
Risk Assessment – analyzes sensor data and explains the level of danger, giving warnings and safety recommendations

On the user side, a React frontend displays real-time sensor readings, alerts, and a map visualization for better awareness.

Overall, RoboSphere combines real-time monitoring, SQLite-based data storage, and AI assistance to create a system that helps users stay safe while also learning and developing robotics projects.