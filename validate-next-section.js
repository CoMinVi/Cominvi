/**
 * Script de validation pour la section "next"
 * Vérifie que toutes les pages ont le même layout pour la section next
 */

const fs = require('fs');
const path = require('path');

const PAGES = [
  'index.html',
  'our-services.html',
  'technology.html',
  'join-the-team.html',
  'about-us.html'
];

const EXPECTED_STRUCTURE = {
  sectionClass: 'section_next',
  buttonClass: 'button-white',
  buttonInnerClass: 'button-white_inner',
  buttonContentClass: 'button-white_inner-content',
  buttonLabelClass: 'button-white_label',
  svgViewBox: '0 0 34 34',
  svgRectWidth: '34',
  svgRectHeight: '34',
  bodyNextText: 'Next page',
  eyebrowLinkText: 'Link'
};

function extractNextSection(html) {
  const sectionRegex = /<div[^>]*class="[^"]*section_next[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*footer[^"]*"/;
  const match = html.match(sectionRegex);
  return match ? match[1] : null;
}

function validateNextSection(htmlPath) {
  console.log(`\n📄 Validation de ${path.basename(htmlPath)}...`);
  
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const errors = [];
  const warnings = [];
  
  const sectionContent = extractNextSection(html);
  if (!sectionContent) {
    errors.push('❌ Section .section_next non trouvée');
    return { errors, warnings };
  }
  
  // Vérifier body-next
  if (!/<p[^>]*class="[^"]*body-next[^"]*"[^>]*>/.test(sectionContent)) {
    errors.push('❌ <p class="body-next"> manquant dans intro_next');
  } else {
    const bodyNextMatch = sectionContent.match(/<p[^>]*class="[^"]*body-next[^"]*"[^>]*>([^<]*)</);
    if (bodyNextMatch && bodyNextMatch[1].trim() !== EXPECTED_STRUCTURE.bodyNextText) {
      warnings.push(`⚠️  Texte body-next incorrect: "${bodyNextMatch[1].trim()}" (attendu: "${EXPECTED_STRUCTURE.bodyNextText}")`);
    }
  }
  
  // Vérifier eyebrows - deuxième eyebrow devrait être "Link"
  const eyebrowMatches = [...sectionContent.matchAll(/<span[^>]*class="[^"]*eyebrow-s[^"]*"[^>]*>([^<]*)</g)];
  if (eyebrowMatches.length >= 2) {
    const secondEyebrow = eyebrowMatches[1][1].trim();
    if (secondEyebrow !== EXPECTED_STRUCTURE.eyebrowLinkText && secondEyebrow !== 'Next Page') {
      warnings.push(`⚠️  Deuxième eyebrow est "${secondEyebrow}" (attendu: "${EXPECTED_STRUCTURE.eyebrowLinkText}")`);
    } else if (secondEyebrow === 'Next Page') {
      errors.push(`❌ Deuxième eyebrow devrait être "${EXPECTED_STRUCTURE.eyebrowLinkText}" mais est "${secondEyebrow}"`);
    }
  }
  
  // Vérifier la classe du bouton
  if (!sectionContent.includes('class="button-white w-inline-block"')) {
    errors.push(`❌ Bouton devrait avoir la classe "button-white"`);
  }
  
  // Vérifier data-wf--button--variant (ne devrait pas être présent)
  if (/data-wf--button--variant=/.test(sectionContent)) {
    errors.push('❌ Attribut data-wf--button--variant ne devrait pas être présent');
  }
  
  // Vérifier data-w-id
  if (!sectionContent.includes('data-w-id=')) {
    warnings.push('⚠️  Attribut data-w-id manquant (peut affecter les animations)');
  }
  
  // Vérifier button-white_inner
  if (!sectionContent.includes('button-white_inner')) {
    errors.push(`❌ Classe "button-white_inner" manquante`);
  }
  
  // Vérifier button-white_inner-content
  if (!sectionContent.includes('button-white_inner-content')) {
    errors.push(`❌ Classe "button-white_inner-content" manquante`);
  }
  
  // Vérifier button-white_label
  if (!sectionContent.includes('button-white_label')) {
    errors.push(`❌ Classe "button-white_label" manquante`);
  }
  
  // Vérifier label-wrap (ne devrait pas être présent)
  if (sectionContent.includes('label-wrap')) {
    errors.push('❌ div.label-wrap ne devrait pas être présent');
  }
  
  // Vérifier sr-only
  if (sectionContent.includes('sr-only')) {
    warnings.push('⚠️  Élément .sr-only présent (devrait être supprimé pour uniformité)');
  }
  
  // Vérifier viewBox des SVG
  const svgViewBoxes = [...sectionContent.matchAll(/viewbox="([^"]*)"/gi)];
  svgViewBoxes.forEach((match, index) => {
    if (match[1] !== EXPECTED_STRUCTURE.svgViewBox) {
      errors.push(`❌ SVG ${index + 1}: viewBox devrait être "${EXPECTED_STRUCTURE.svgViewBox}" mais est "${match[1]}"`);
    }
  });
  
  // Vérifier dimensions rect des SVG
  const rectDimensions = [...sectionContent.matchAll(/<rect[^>]*width="([^"]*)"[^>]*height="([^"]*)"/g)];
  rectDimensions.forEach((match, index) => {
    const width = match[1];
    const height = match[2];
    if (width !== EXPECTED_STRUCTURE.svgRectWidth || height !== EXPECTED_STRUCTURE.svgRectHeight) {
      errors.push(`❌ SVG rect ${index + 1}: devrait être ${EXPECTED_STRUCTURE.svgRectWidth}x${EXPECTED_STRUCTURE.svgRectHeight} mais est ${width}x${height}`);
    }
  });
  
  // Vérifier prefetch
  if (!/<link[^>]*rel="prefetch"/.test(sectionContent)) {
    warnings.push('⚠️  Lien de prefetch manquant');
  }
  
  // Vérifier background
  if (!sectionContent.includes('next_background-wrap')) {
    errors.push('❌ .next_background-wrap manquant');
  } else if (!/<img[^>]*class="[^"]*background[^"]*"/.test(sectionContent)) {
    errors.push('❌ Image de background manquante');
  }
  
  return { errors, warnings };
}

function main() {
  console.log('🔍 Validation des sections "next" sur toutes les pages\n');
  console.log('=' .repeat(70));
  
  let totalErrors = 0;
  let totalWarnings = 0;
  const results = {};
  
  PAGES.forEach(page => {
    const filePath = path.join(__dirname, page);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n❌ Fichier ${page} non trouvé`);
      return;
    }
    
    const { errors, warnings } = validateNextSection(filePath);
    results[page] = { errors, warnings };
    
    totalErrors += errors.length;
    totalWarnings += warnings.length;
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Validation réussie !');
    } else {
      if (errors.length > 0) {
        console.log('\nErreurs:');
        errors.forEach(err => console.log(`  ${err}`));
      }
      if (warnings.length > 0) {
        console.log('\nAvertissements:');
        warnings.forEach(warn => console.log(`  ${warn}`));
      }
    }
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Résumé:');
  console.log(`   Pages validées: ${PAGES.length}`);
  console.log(`   Erreurs totales: ${totalErrors}`);
  console.log(`   Avertissements totaux: ${totalWarnings}`);
  
  if (totalErrors === 0) {
    console.log('\n✅ Toutes les sections "next" sont conformes !');
    process.exit(0);
  } else {
    console.log('\n❌ Des corrections sont nécessaires.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateNextSection };
