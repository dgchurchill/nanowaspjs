<?xml version="1.0"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:output method="text" />

  <xsl:template match="/microbee/device">
<xsl:if test="State != ''">
<xsl:text>        </xsl:text><xsl:value-of select="@id" />: "<xsl:value-of select="State" />",
</xsl:if>
  </xsl:template>

  <xsl:template match="*/text()[normalize-space()]">
    <xsl:value-of select="normalize-space()"/>
  </xsl:template>

  <xsl:template match="*/text()[not(normalize-space())]" />
</xsl:stylesheet>
