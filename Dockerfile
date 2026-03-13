FROM apify/actor-node-playwright:24-beta
USER root

# Copy the package management files first. This step is cached by Docker,
# so dependencies won't be re-installed unless these files change.
COPY package*.json ./

# Install Node.js dependencies. The --omit=dev flag skips development-only packages,
# keeping the final image smaller and more secure.
RUN npm install --omit=dev
RUN npx playwright install --with-deps

# Copy the rest of your project's source code into the container.
COPY . .

# Set the command to run when the container starts. This executes the "start"
# script defined in your package.json file.
CMD [ "npm", "start" ]
