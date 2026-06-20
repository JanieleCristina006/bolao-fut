interface ArquivoZip {
  nome: string;
  blob: Blob;
}

const tabelaCrc = Array.from({ length: 256 }, (_, indice) => {
  let valor = indice;
  for (let bit = 0; bit < 8; bit += 1) {
    valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
  }
  return valor >>> 0;
});

function crc32(dados: Uint8Array): number {
  let crc = 0xffffffff;
  dados.forEach((valor) => {
    crc = tabelaCrc[(crc ^ valor) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function dataDos(data = new Date()): { hora: number; dia: number } {
  const ano = Math.max(1980, data.getFullYear());
  return {
    hora: (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2),
    dia: ((ano - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate()
  };
}

function escrever16(view: DataView, offset: number, valor: number): number {
  view.setUint16(offset, valor, true);
  return offset + 2;
}

function escrever32(view: DataView, offset: number, valor: number): number {
  view.setUint32(offset, valor, true);
  return offset + 4;
}

export async function criarArquivoZip(arquivos: ArquivoZip[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const partesLocais: BlobPart[] = [];
  const partesCentrais: BlobPart[] = [];
  const { hora, dia } = dataDos();
  let offsetLocal = 0;
  let tamanhoCentral = 0;

  for (const arquivo of arquivos) {
    const nome = encoder.encode(arquivo.nome);
    const dados = new Uint8Array(await arquivo.blob.arrayBuffer());
    const crc = crc32(dados);

    const cabecalhoLocal = new ArrayBuffer(30 + nome.length);
    const viewLocal = new DataView(cabecalhoLocal);
    let offset = 0;
    offset = escrever32(viewLocal, offset, 0x04034b50);
    offset = escrever16(viewLocal, offset, 20);
    offset = escrever16(viewLocal, offset, 0x0800);
    offset = escrever16(viewLocal, offset, 0);
    offset = escrever16(viewLocal, offset, hora);
    offset = escrever16(viewLocal, offset, dia);
    offset = escrever32(viewLocal, offset, crc);
    offset = escrever32(viewLocal, offset, dados.length);
    offset = escrever32(viewLocal, offset, dados.length);
    offset = escrever16(viewLocal, offset, nome.length);
    escrever16(viewLocal, offset, 0);
    new Uint8Array(cabecalhoLocal, 30).set(nome);

    partesLocais.push(cabecalhoLocal, dados);

    const cabecalhoCentral = new ArrayBuffer(46 + nome.length);
    const viewCentral = new DataView(cabecalhoCentral);
    offset = 0;
    offset = escrever32(viewCentral, offset, 0x02014b50);
    offset = escrever16(viewCentral, offset, 20);
    offset = escrever16(viewCentral, offset, 20);
    offset = escrever16(viewCentral, offset, 0x0800);
    offset = escrever16(viewCentral, offset, 0);
    offset = escrever16(viewCentral, offset, hora);
    offset = escrever16(viewCentral, offset, dia);
    offset = escrever32(viewCentral, offset, crc);
    offset = escrever32(viewCentral, offset, dados.length);
    offset = escrever32(viewCentral, offset, dados.length);
    offset = escrever16(viewCentral, offset, nome.length);
    offset = escrever16(viewCentral, offset, 0);
    offset = escrever16(viewCentral, offset, 0);
    offset = escrever16(viewCentral, offset, 0);
    offset = escrever16(viewCentral, offset, 0);
    offset = escrever32(viewCentral, offset, 0);
    escrever32(viewCentral, offset, offsetLocal);
    new Uint8Array(cabecalhoCentral, 46).set(nome);

    partesCentrais.push(cabecalhoCentral);
    offsetLocal += cabecalhoLocal.byteLength + dados.length;
    tamanhoCentral += cabecalhoCentral.byteLength;
  }

  const final = new ArrayBuffer(22);
  const viewFinal = new DataView(final);
  let offset = 0;
  offset = escrever32(viewFinal, offset, 0x06054b50);
  offset = escrever16(viewFinal, offset, 0);
  offset = escrever16(viewFinal, offset, 0);
  offset = escrever16(viewFinal, offset, arquivos.length);
  offset = escrever16(viewFinal, offset, arquivos.length);
  offset = escrever32(viewFinal, offset, tamanhoCentral);
  offset = escrever32(viewFinal, offset, offsetLocal);
  escrever16(viewFinal, offset, 0);

  return new Blob([...partesLocais, ...partesCentrais, final], { type: "application/zip" });
}

export function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
