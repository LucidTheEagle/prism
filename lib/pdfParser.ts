export async function extractPDFText(buffer: ArrayBuffer): Promise<{ text: string; numPages: number }> {
    const nodeBuffer = Buffer.from(buffer)
    
    // Use the main export with proper typing
    const pdfParse = (await import('pdf-parse')).default
    
    try {
      const data = await pdfParse(nodeBuffer)
      
      return {
        text: data.text,
        numPages: data.numpages
      }
    } catch (error) {
      console.error('PDF parsing error:', error)
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }