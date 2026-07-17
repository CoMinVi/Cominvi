# Stabilisation du hero lors d’une navigation

## Constat

Au départ d’une navigation Barba depuis la home, le hero peut être recalculé
alors que le `page-wrap` entre dans son animation de sortie. Ce recalcul
modifie brièvement la frame ou la position du visuel avant le déplacement de
la page.

## Décision

Au `beforeLeave` de la home, la séquence conservera sa progression courante,
puis ses sources de mise à jour seront arrêtées pour la transition :

- le tween de parallax est détruit sans réinitialiser sa transformée ;
- le listener de repaint de `ScrollTrigger` est retiré ;
- la progression de la séquence est appliquée une dernière fois ;
- le contrôleur fige sa surface sans lancer de repaint pendant le leave.

La transition Barba, le scale du `page-wrap` et le rendu de la page suivante
restent inchangés.

## Vérification

Un test automatisé vérifiera que la suspension conserve la progression et
supprime les drivers de mise à jour, sans remettre la position du hero à zéro.
La build et le lint confirmeront ensuite l’intégration du correctif.
