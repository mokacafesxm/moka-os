export default {
  id: "fermeture-salle",
  nom: "Fermeture Salle",
  zone: "Salle",
  steps: [
    {
      key: "nettoyage-salle",
      type: "checklist",
      label: "Nettoyage",
      items: [
        "Tables débarrassées et nettoyées",
        "Sol balayé",
        "Poubelles vidées",
      ],
    },
  ],
};
