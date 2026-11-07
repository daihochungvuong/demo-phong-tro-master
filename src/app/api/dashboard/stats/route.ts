import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Phong from '@/models/Phong';
import HoaDon from '@/models/HoaDon';
import SuCo from '@/models/SuCo';
import HopDong from '@/models/HopDong';
import ThanhToan from '@/models/ThanhToan';
import { cacheGet, cacheSet } from '@/lib/redis';

const CACHE_KEY = 'dashboard:stats';
const CACHE_TTL = 60;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cached = await cacheGet<typeof stats>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, source: 'cache' });
    }

    await dbConnect();

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const [totalPhong, phongTrong, phongDangThue, phongBaoTri] = await Promise.all([
      Phong.countDocuments(),
      Phong.countDocuments({ trangThai: 'trong' }),
      Phong.countDocuments({ trangThai: 'dangThue' }),
      Phong.countDocuments({ trangThai: 'baoTri' }),
    ]);

    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const [doanhThuThang, doanhThuNam, nextWeek, nextMonth] = await Promise.all([
      ThanhToan.aggregate([
        { $match: { ngayThanhToan: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$soTien' } } },
      ]),
      ThanhToan.aggregate([
        { $match: { ngayThanhToan: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { _id: null, total: { $sum: '$soTien' } } },
      ]),
      Promise.resolve((() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })()),
      Promise.resolve((() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })()),
    ]);

    const [hoaDonSapDenHan, suCoCanXuLy, hopDongSapHetHan] = await Promise.all([
      HoaDon.countDocuments({
        hanThanhToan: { $lte: nextWeek },
        trangThai: { $in: ['chuaThanhToan', 'daThanhToanMotPhan'] },
      }),
      SuCo.countDocuments({ trangThai: { $in: ['moi', 'dangXuLy'] } }),
      HopDong.countDocuments({
        ngayKetThuc: { $lte: nextMonth },
        trangThai: 'hoatDong',
      }),
    ]);

    const stats = {
      tongSoPhong: totalPhong,
      phongTrong,
      phongDangThue,
      phongBaoTri,
      doanhThuThang: doanhThuThang[0]?.total || 0,
      doanhThuNam: doanhThuNam[0]?.total || 0,
      hoaDonSapDenHan,
      suCoCanXuLy,
      hopDongSapHetHan,
    };

    await cacheSet(CACHE_KEY, stats, CACHE_TTL);

    return NextResponse.json({
      success: true,
      data: stats,
      source: 'db',
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
