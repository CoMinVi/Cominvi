# Scroll natif sur mobile et tablette

## Objectif

Désactiver Lenis jusqu’au breakpoint Webflow tablette (`max-width: 991px`) sans
casser le scroll, les animations ScrollTrigger, les transitions Barba ni le
hero de la home. Le desktop (`min-width: 992px`) conserve Lenis.

## Diagnostic

La section `technology` de la home n’exécute pas `technology.js`, réservé à la
page Technology. Les sauts qui deviennent visibles à cet endroit sont liés au
système de scroll global :

- Lenis pilote `.page-wrap` avec `syncTouch` et un proxy ScrollTrigger ;
- `.page-wrap` est limitée à `100dvh` avec `overflow: hidden`, ce qui interdit
  un simple retour au scroll tactile natif ;
- le pin de Safety, juste avant Technology, utilise `pinSpacing: false` ;
- plusieurs initialisations différées déclenchent des refresh ScrollTrigger
  globaux et recalculent ce pin ainsi que les sections suivantes ;
- Cylinder et Parallax sont initialisés deux fois sur la home, ajoutant des
  recalculs différés.

Lenis n’est donc pas la seule source possible de déplacement, mais son mode
tactile virtualisé amplifie les recalculs autour des pins et changements de
hauteur. Le retirer sur les petits viewports élimine cette couche sans masquer
les problèmes de layout.

## Conception retenue

### Sélection du moteur

Une fonction testable sélectionne le mode natif lorsque
`matchMedia('(max-width: 991px)')` correspond. Le choix est refait à chaque
initialisation de page Barba. Aucun changement dynamique de moteur pendant un
simple redimensionnement n’est nécessaire : un rechargement ou une navigation
Barba réévalue le breakpoint.

### Mode desktop

Le comportement actuel reste inchangé :

- instance Lenis sur `.page-wrap` / `.content-wrap` ;
- ticker GSAP ;
- `scrollerProxy` ;
- ScrollTrigger configuré sur `.page-wrap`.

### Mode mobile et tablette

- aucune instance Lenis et aucun ticker Lenis ;
- une classe d’état sur le document active le CSS natif ;
- `.page-wrap` reprend une hauteur automatique et un overflow visible ;
- `.content-wrap` ne force plus `will-change: transform` ;
- ScrollTrigger utilise `window` comme scroller par défaut, sans proxy Lenis ;
- la position initiale est remise à zéro puis les triggers sont rafraîchis une
  fois le layout stabilisé.

### Compatibilité des modules

Les modules qui ont déjà un fallback ScrollTrigger continuent de fonctionner
sans Lenis. Les listeners exclusivement branchés sur `window.lenis` (navigation,
sticky du bouton Next et cas similaires réellement utilisés) reçoivent un
fallback `window.scroll` nettoyable. Les opérations `stop`, `start`, `scrollTo`
conservent leur fallback natif existant ou en reçoivent un lorsque nécessaire.

Le nettoyage commun doit :

- retirer le ticker et détruire Lenis sur desktop ;
- retirer les listeners natifs enregistrés par le mode mobile ;
- effacer les références globales obsolètes ;
- restaurer des defaults ScrollTrigger cohérents avant la prochaine page.

## Réduction des causes de saut adjacentes

La correction reste ciblée. Les doubles initialisations directement prouvées
sur la home sont supprimées :

- Cylinder n’est initialisé que par le registre de page ;
- Parallax n’est initialisé qu’une fois avec les autres modules.

Le pin Safety et ses refresh seront conservés dans un premier temps afin de ne
pas modifier son rendu. Les tests instrumentés permettront de distinguer un
défaut résiduel du pin d’un défaut du moteur de scroll.

## Vérification

- test unitaire du choix natif à `991px` et Lenis à `992px` ;
- test navigateur à largeur mobile et tablette : absence de Lenis, scroll
  document natif, progression au-delà du hero jusqu’à Technology et Partners ;
- test desktop : Lenis présent et wrapper ScrollTrigger inchangé ;
- navigation Barba dans les deux modes ;
- absence de doubles listeners après réinitialisation ;
- lint ciblé puis `yarn build`.

## Retour arrière

Le tag distant `backup/pre-mobile-lenis-20260716` référence exactement le commit
`7fc71a4f9bd1b5fa216712b4b1fb530176bea324`.
