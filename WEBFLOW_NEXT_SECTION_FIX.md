# Corrections nécessaires pour la section "next"

## Problème identifié

La section "next" sur la page **technology.html** utilise un layout différent de celui des autres pages (home, our-services, join-the-team, about-us).

## Layout cible (home et autres pages)

Structure HTML à reproduire :
```html
<div bg="black" class="section_next">
  <div class="intro_next">
    <div class="eyebrows is-white">
      <div class="is-eyebrow"><span class="eyebrow-s">S.XX</span></div>
      <div class="is-eyebrow"><span class="eyebrow-s">Link</span></div>
    </div>
    <p tr="1" class="body-next">Next page</p>
  </div>
  <div class="next-button-wrapper">
    <a pt-next="" data-w-id="687c3d2f-385d-93aa-43fe-a460e90d552d" href="[PAGE].html" class="button-white w-inline-block">
      <div class="button-white_inner">
        <div class="w-layout-hflex button-white_inner-content">
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewbox="0 0 34 34" fill="none" class="is-arrow-square is-left">
            <rect x="0.0588379" width="34" height="34" rx="4" fill="currentColor" class="arrow-white-1_bg"></rect>
            <path d="M14.0295 9.26572C14.0295 8.67179 14.7476 8.37434 15.1676 8.79432L22.8718 16.4986C23.1322 16.7589 23.1322 17.181 22.8718 17.4414L15.1676 25.1456C14.7476 25.5656 14.0295 25.2681 14.0295 24.6742V9.26572Z" fill="currentColor" class="arrow-white-1_arrow"></path>
          </svg>
          <span class="button-white_label">[PAGE_NAME]</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewbox="0 0 34 34" fill="none" class="is-arrow-square">
            <rect x="0.0588379" width="34" height="34" rx="4" fill="currentColor" class="arrow-white-2_bg"></rect>
            <path d="M14.0295 9.26572C14.0295 8.67179 14.7476 8.37434 15.1676 8.79432L22.8718 16.4986C23.1322 16.7589 23.1322 17.181 22.8718 17.4414L15.1676 25.1456C14.7476 25.5656 14.0295 25.2681 14.0295 24.6742V9.26572Z" fill="currentColor" class="arrow-white-2_arrow"></path>
          </svg>
        </div>
      </div>
    </a>
    <link rel="prefetch" href="/[PAGE]">
  </div>
  <div class="next_background-wrap">
    <div class="next_background">
      <img src="images/[PAGE]-hero.avif" loading="lazy" sizes="..." srcset="..." alt="" class="background">
    </div>
  </div>
</div>
```

## Layout actuel (technology.html - À CORRIGER)

Structure actuelle incorrecte :
```html
<div bg="black" class="section_next">
  <div class="intro_next">
    <div class="eyebrows is-white">
      <div class="is-eyebrow"><span class="eyebrow-s">S.08</span></div>
      <div class="is-eyebrow">
        <span class="eyebrow-s">Next Page</span> <!-- ⚠️ Devrait être "Link" -->
      </div>
    </div>
  </div>
  <div class="next-button-wrapper">
    <a pt-next="" 
       aria-label="See more about safety"
       data-wf--button--variant="button-white" <!-- ⚠️ Ne devrait pas être là -->
       href="safety.html"
       class="button w-variant-a211fbf9-8f10-d13e-69e9-810a5e3873c2 w-inline-block"> <!-- ⚠️ Devrait être "button-white" -->
      <div class="button_inner"> <!-- ⚠️ Devrait être "button-white_inner" -->
        <div class="w-layout-hflex button-inner_content"> <!-- ⚠️ Devrait être "button-white_inner-content" -->
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewbox="0 0 32 32" fill="none" class="is-arrow-square is-left"> <!-- ⚠️ Devrait être 34x34 -->
            <!-- SVG incorrect avec 32x32 au lieu de 34x34 -->
          </svg>
          <div class="label-wrap"> <!-- ⚠️ Ne devrait pas être dans un div -->
            <span class="button_label-small w-variant-a211fbf9-8f10-d13e-69e9-810a5e3873c2">Safety</span> <!-- ⚠️ Devrait être "button-white_label" -->
          </div>
          <span class="sr-only">See more about safety</span> <!-- ⚠️ Ne devrait pas être là -->
          <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewbox="0 0 32 32" fill="none" class="is-arrow-square"> <!-- ⚠️ Devrait être 34x34 -->
            <!-- SVG incorrect -->
          </svg>
        </div>
      </div>
    </a>
  </div>
</div>
```

## Modifications à apporter dans Webflow

### Page : **Technology**

1. **Section intro_next**
   - Ajouter l'élément manquant : `<p tr="1" class="body-next">Next page</p>` après les eyebrows
   - Changer le texte de l'eyebrow de "Next Page" à "Link"

2. **Bouton next**
   - Remplacer la classe `button` par `button-white`
   - Supprimer l'attribut `data-wf--button--variant="button-white"`
   - Supprimer la classe de variante `w-variant-a211fbf9-8f10-d13e-69e9-810a5e3873c2`
   - Ajouter l'attribut `data-w-id="687c3d2f-385d-93aa-43fe-a460e90d552d"`

3. **Structure interne du bouton**
   - Remplacer `button_inner` par `button-white_inner`
   - Remplacer `button-inner_content` par `button-white_inner-content`
   - Supprimer le `<div class="label-wrap">` et mettre directement le `<span>`
   - Remplacer `button_label-small` par `button-white_label`
   - Supprimer la classe de variante du span
   - Supprimer l'élément `<span class="sr-only">See more about safety</span>`

4. **SVG des flèches**
   - Changer le viewbox de `0 0 32 32` à `0 0 34 34`
   - Changer les dimensions du rect : `width="34" height="34"`
   - Mettre à jour le path avec les bonnes coordonnées :
     ```
     d="M14.0295 9.26572C14.0295 8.67179 14.7476 8.37434 15.1676 8.79432L22.8718 16.4986C23.1322 16.7589 23.1322 17.181 22.8718 17.4414L15.1676 25.1456C14.7476 25.5656 14.0295 25.2681 14.0295 24.6742V9.26572Z"
     ```

5. **Ajouter après le lien**
   - Ajouter `<link rel="prefetch" href="/safety">` après la balise `</a>`

6. **Ajouter la section background**
   - Ajouter après `next-button-wrapper` :
   ```html
   <div class="next_background-wrap">
     <div class="next_background">
       <img src="images/safety-hero.avif" loading="lazy" sizes="..." srcset="..." alt="" class="background">
     </div>
   </div>
   ```

## Vérification

Après les modifications, toutes les pages (index, our-services, join-the-team, about-us, technology) devraient avoir une section "next" avec le même layout :
- Même structure HTML
- Même classes CSS
- Même dimensions pour les SVG (34x34)
- Même attributs data-w-id
- Présence de l'élément `<p class="body-next">Next page</p>`
- Texte "Link" dans l'eyebrow (pas "Next Page")
- Background image visible
