/** Jeu d'or d'exemple (données fictives). Sert de modèle et de contrôle du montage. */
export const exemple: unknown = {
  "nom": "exemple-tri-de-messages",
  "version_prompt": "v1",
  "invite": "Classe le message. Réponds uniquement en JSON : {\"categorie\": \"facture\"|\"question\"|\"autre\", \"urgent\": true|false}.",
  "sortie": { "categorie": ["facture", "question", "autre"], "urgent": "booleen" },
  "seuil": 0.9,
  "cas": [
    { "id": "c1", "entree": "Voici la facture de mars.", "attendu": { "categorie": "facture", "urgent": false } },
    { "id": "c2", "entree": "Pouvez-vous me rappeler demain ?", "attendu": { "categorie": "question", "urgent": false } },
    { "id": "c3", "entree": "URGENT : paiement refusé sur la facture 12.", "attendu": { "categorie": "facture", "urgent": true } }
  ]
}
;
