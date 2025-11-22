# Configuration Lambda
FUNCTION_NAME = mailAnalyzer
REGION = eu-west-3
ZIP_FILE = lambda-deployment.zip

# Installation des dépendances
.PHONY: install
install:
	npm install

# Création du package ZIP pour Lambda
.PHONY: zip
zip: clean
	@echo "Création du package ZIP..."
	zip -r $(ZIP_FILE) index.js node_modules/ package.json
	@echo "Package créé: $(ZIP_FILE)"

# Mise à jour de la fonction Lambda
.PHONY: deploy
deploy: zip
	@echo "Déploiement vers AWS Lambda..."
	aws lambda update-function-code \
		--function-name $(FUNCTION_NAME) \
		--zip-file fileb://$(ZIP_FILE) \
		--region $(REGION)
	@echo "Déploiement terminé"

# Nettoyage des fichiers temporaires
.PHONY: clean
clean:
	@echo "Nettoyage des fichiers temporaires..."
	rm -f $(ZIP_FILE)
	@echo "Nettoyage terminé"

# Suppression complète (node_modules et fichiers générés)
.PHONY: deep-clean
deep-clean: clean
	rm -rf node_modules/
	rm -f package-lock.json
	@echo "Nettoyage complet terminé"

# Aide
.PHONY: help
help:
	@echo "Commandes disponibles:"
	@echo "  make install      - Installer les dépendances npm"
	@echo "  make zip          - Créer le package ZIP pour Lambda"
	@echo "  make deploy       - Déployer vers AWS Lambda ($(FUNCTION_NAME) dans $(REGION))"
	@echo "  make clean        - Nettoyer les fichiers temporaires"
	@echo "  make deep-clean   - Nettoyer complètement (inclut node_modules)"
	@echo "  make help         - Afficher cette aide"
