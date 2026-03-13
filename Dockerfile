# Use the official Apify base image that includes Node.js 18 and Python 3.11.
# This provides a standardized environment for both parts of your project.
FROM apify/actor-node-playwright:24-beta
USER root

RUN apt-get update -y && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Copy the package management files first. This step is cached by Docker,
# so dependencies won't be re-installed unless these files change.
COPY package*.json ./
COPY requirements.txt ./

# Install Python dependencies from your requirements.txt file.
RUN pip install --break-system-packages -r requirements.txt

# Install Node.js dependencies. The --omit=dev flag skips development-only packages,
# keeping the final image smaller and more secure.
RUN npm install --omit=dev
RUN npx playwright install --with-deps

# Copy the rest of your project's source code into the container.
COPY . .

# Set the command to run when the container starts. This executes the "start"
# script defined in your package.json file.
CMD [ "npm", "start" ]