# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the source code
COPY src/ src/

# We need to set pythonpath or run from src
# Easiest is to set env var
ENV PYTHONPATH=/app

# Expose port 5000 for the Flask application
EXPOSE 5000

# Define environment variables
ENV FLASK_APP=src/app.py
ENV FLASK_RUN_HOST=0.0.0.0

# Run app.py when the container launches
CMD ["python", "src/app.py"]
