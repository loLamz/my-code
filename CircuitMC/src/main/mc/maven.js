'use strict';

// Converts a Maven coordinate ("group.id:artifact:version[:classifier][@ext]")
// into the relative file path Maven repos (and Mojang's library layout) use.
function mavenNameToPath(name) {
  const [core, ext = 'jar'] = name.split('@');
  const parts = core.split(':');
  const [group, artifact, version, classifier] = parts;
  const groupPath = group.replace(/\./g, '/');
  const fileName = classifier
    ? `${artifact}-${version}-${classifier}.${ext}`
    : `${artifact}-${version}.${ext}`;
  return `${groupPath}/${artifact}/${version}/${fileName}`;
}

module.exports = { mavenNameToPath };
