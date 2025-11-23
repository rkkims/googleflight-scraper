# First, specify the base Docker image. You can use any image that has both
# Node.js and Python installed. Apify provides such images.
FROM apify/actor-node-python:18-3.11

# Second, copy just package.json and package-lock.json if you have them.
# This leverages Docker cache to avoid re-installing dependencies on every build.
COPY package*.json ./

# Then, copy the Python requirements file and install the dependencies.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Install npm dependencies
RUN npm install

# Finally, copy the rest of your source code files.
COPY . ./
